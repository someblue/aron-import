import { HtmlParser, Visitor, Attribute, Element, Expansion, Text, Comment, ExpansionCase, NAMED_ENTITIES } from '@angular/compiler';

import { StringUtil } from './string.util';

export class AronHtmlBuilder {
    private buffer: string[] = [];

    private indent = 0;
    private tagStack: string[] = [];
    private isInsideTag = false;
    private hasAttritubeInsideCurrentTag = false;

    constructor(
        private indentText: string = '    ', // default 4 space
    ) { }

    toString(): string {
        return this.buffer.join('').trim();
    }

    openTag(tagName: string) {
        this.addTagCloseIfInsideTag();
        this.tagStack.push(tagName);
        this.isInsideTag = true;
        this.nextline();
        this.buffer.push(`<${tagName}`);
    }

    closeTag(isSelfClose: boolean) {
        if (this.tagStack.length === 0) {
            throw new Error('cant close tag while tag stack is empty');
        }
        if (isSelfClose) {
            this.buffer.push('/>');
            this.isInsideTag = false;
            this.hasAttritubeInsideCurrentTag = false;
            this.tagStack.pop();
            return;
        }
        this.indent--;
        this.addTagCloseIfInsideTag();
        this.nextline();
        const tagName = this.tagStack.pop();
        this.buffer.push(`</${tagName}>`);
    }

    attritube(name: string, value: string | null) {
        if (!this.isInsideTag) {
            throw new Error('cant add attritube outside a tag');
        }

        const tagIndent = StringUtil.generate(this.getCurrentTagName().length + 2);

        if (!this.hasAttritubeInsideCurrentTag) {
            this.buffer.push(' ');
            this.hasAttritubeInsideCurrentTag = true;
        } else {
            this.nextline();
            this.buffer.push(tagIndent);
        }

        if (!value) {
            this.buffer.push(name);
            return;
        }

        if (name === 'class') {
            value = value.split(/\s+/).join('\n');
        }
        if (name === 'style') {
            value = value.split(';').filter(e => e.trim().length > 0).map(e => e.trim() + ';').join('\n');
        }

        if (value.indexOf('\n') === -1) {
            this.buffer.push(`${name}="${value}"`);
        } else {
            // the length of 'name="' is the length of name + 2
            const attritubeNameIndent = StringUtil.generate(name.length + 2);

            let values = value.split('\n');
            values = values.map((e, i) => {
                if (i === 0) {
                    return e.trim();
                }
                return this.getIndent() + tagIndent + attritubeNameIndent + e.trim();
            });

            value = values.join('\n');
            this.buffer.push(`${name}="${value}"`);
        }
    }

    text(content: string) {
        this.addTagCloseIfInsideTag();
        if (content.indexOf('\n') === -1) {
            this.nextline();
            this.buffer.push(content.trim());
        } else {
            this.buffer.push('\n');
            this.buffer.push(this.indentMultilineContent(content));
        }
    }

    comment(content: string) {
        this.addTagCloseIfInsideTag();
        this.nextline();
        if (content.indexOf('\n') === -1) {
            this.buffer.push(`<!-- ${content.trim()} -->`);
        } else {
            this.buffer.push('<!--\n');
            this.buffer.push(this.indentMultilineContent(content).split('\n').map(e => this.indentText + e).join('\n'));
            this.nextline();
            this.buffer.push('-->');
        }
    }

    emptyNewline() {
        this.addTagCloseIfInsideTag();
        this.buffer.push('\n');
    }

    private addTagClose() {
        this.buffer.push('>');
        this.isInsideTag = false;
        this.hasAttritubeInsideCurrentTag = false;
        this.indent++;
    }

    private addTagCloseIfInsideTag(): boolean {
        if (this.isInsideTag) {
            this.addTagClose();
            return true;
        }
        return false;
    }

    private getIndent(): string {
        return StringUtil.generate(this.indent, this.indentText);
    }

    private nextline() {
        this.buffer.push('\n');
        this.buffer.push(this.getIndent());
    }

    private getCurrentTagName(): string {
        if (this.tagStack.length === 0) {
            throw new Error('cant get tag name while tag stack is empty');
        }
        return this.tagStack[this.tagStack.length - 1];
    }

    private indentMultilineContent(content: string): string {
        return content.trim().split('\n').map(e => {
            if (e.trim().length === 0) {
                return '';
            }
            return this.getIndent() + e.trim();
        }).join('\n');
    }
}

class AronHtmlVisitor implements Visitor {
    constructor(
        private builder: AronHtmlBuilder,
    ) { }

    private readonly selfCloseTags = [
        'area',
        'base',
        'br',
        'col',
        'command',
        'embed',
        'hr',
        'img',
        'input',
        'keygen',
        'link',
        'menuitem',
        'meta',
        'param',
        'source',
        'track',
        'wbr',
    ];

    private isSelfCloseTag(tagName: string): boolean {
        return this.selfCloseTags.indexOf(tagName) >= 0;
    }

    visitElement(element: Element, ctx: any) {
        this.builder.openTag(element.name);
        element.attrs.forEach(e => e.visit(this, ctx));
        element.children.forEach(e => e.visit(this, ctx));
        // const isSelfClose = element.startSourceSpan !== null && element.endSourceSpan !== null &&
        //     element.startSourceSpan.toString() === element.endSourceSpan.toString();
        const isSelfClose = this.isSelfCloseTag(element.name);
        this.builder.closeTag(isSelfClose);
    }

    visitComment(comment: Comment, ctx: any) {
        this.builder.comment(comment.value || '');
    }

    visitText(text: Text, ctx: any) {
        if (text.value.trim().length === 0) {
            const nOccurTime = StringUtil.occurCount(text.value, '\n');
            for (let i = 0; i < nOccurTime - 1; i++) {
                this.builder.emptyNewline();
            }
            return;
        }
        this.builder.text(text.value);
    }

    visitAttribute(attribute: Attribute, ctx: any) {
        this.builder.attritube(attribute.name, attribute.value);
    }

    visitExpansion(expansion: Expansion, ctx: any) {
    }

    visitExpansionCase(expansionCase: ExpansionCase, ctx: any) {
    }
}

// Angular html parser will convert named entities to the converted character, etc. '&nbsp' -> ' ', '&gt' -> '>'.
// However this conversion is unexpected, our source code need to retain as '&nbsp'.
// Angular html parser doesn't provide configure to disable conversion.
// I use this middleware to preprocess source code by converting named entities to a special format before sending it to parser,
// and postprocess result by converting special format to named entities after formation is completed.
export class NamedEntitiesMiddleware {
    preprocess(src: string): string {
        // NAMED_ENTITIES includes:
        //     'nbsp': '\u00A0',
        //     'gt': '>',
        //     ......
        for (let name in NAMED_ENTITIES) {
            var regex = new RegExp('&' + name, 'igm');
            src = src.replace(regex, `$NAMED_ENTITIES(${name})`);
        }
        return src;
    }

    postprocess(src: string): string {
        for (let name in NAMED_ENTITIES) {
            var regex = new RegExp(`\\\$NAMED_ENTITIES\\\(${name}\\\)`, 'igm');
            src = src.replace(regex, '&' + name);
        }
        return src;
    }
}

export class AngularTemplateFormatter {
    // baseIndent default 8 space
    work(src: string, baseIndent: string = '        '): string {
        const namedEntitiesMiddleware = new NamedEntitiesMiddleware();
        src = namedEntitiesMiddleware.preprocess(src);

        const rawHtmlParser = new HtmlParser();
        const htmlResult = rawHtmlParser.parse(src, '', true);

        let builder = new AronHtmlBuilder();
        let visitor = new AronHtmlVisitor(builder);
        htmlResult.rootNodes.forEach(node => {
            node.visit(visitor, null);
        });
        const builderResult = builder.toString()
            .split('\n').map(e => e.trim() ? baseIndent + e : '').join('\n');
        return namedEntitiesMiddleware.postprocess(builderResult);
    }
}
