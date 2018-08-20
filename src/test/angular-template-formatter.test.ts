import * as assert from 'assert';

import { AngularTemplateFormatter, AronHtmlBuilder } from '../angular-template-formatter';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
// import * as vscode from 'vscode';
// import * as myExtension from '../extension';

// Defines a Mocha test suite to group tests of similar kind together
suite("Extension Tests", function () {
    test("Formatter", function () {
        const formatter = new AngularTemplateFormatter();
        const template = `
            <!-- comp-wrapper -->
    <div class="comp-wrapper
                        wh-100-pc">
                <div *ngFor="let e of imgUrls; let i = index; let isFirst = first"
                     [style.height.px]="Sizer.height | alphaColor">

            <img style="background-color:black" [attr.src]="http://dummy.com"/>
            <input>

                            </div>
                <!-- multiline comment
                line2
                line3
                -->
    <ng-template #tmplXxx>

                    {{ abc }}
    hahaha
                        wtf
                    xyz

                    
                        </ng-template>
            </div>
        `;
        const result = formatter.work(template);
        assert.equal(
            result.trim(),
            `
        <!-- comp-wrapper -->
        <div class="comp-wrapper
                    wh-100-pc">
            <div *ngFor="let e of imgUrls; let i = index; let isFirst = first"
                 [style.height.px]="Sizer.height | alphaColor">

                <img style="background-color:black;"
                     [attr.src]="http://dummy.com"/>
                <input/>

            </div>
            <!--
                multiline comment
                line2
                line3
            -->
            <ng-template #tmplXxx>
                {{ abc }}
                hahaha
                wtf
                xyz
            </ng-template>
        </div>
            `.trim());
    });

    test('builder', function () {
        const builder = new AronHtmlBuilder();
        builder.openTag('div');
        builder.attritube('class', 'comp-wrapper\n  wh-100-pc   flex-row-aligner  \n v-center-aligner');
        builder.attritube('style', 'width: 50px;height:20px');
        builder.attritube('[style.height.px]', 'Sizer.heightPx');
        builder.openTag('img');
        builder.attritube('[attr.src]', 'http://www.dummy.com');
        builder.closeTag(true);
        builder.text('{{ content }}');
        builder.closeTag(false);

        assert.equal(
            builder.toString().trim(),
            `
<div class="comp-wrapper
            wh-100-pc
            flex-row-aligner
            v-center-aligner"
     style="width: 50px;
            height:20px;"
     [style.height.px]="Sizer.heightPx">
    <img [attr.src]="http://www.dummy.com"/>
    {{ content }}
</div>
            `.trim());
    });
});
