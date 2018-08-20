# aron-import README

Typescript import sorter.

## Features

### Sort Import

The order of typescript file will be sort automatically on save file. Unnecessary import path like `../../node_modules/...` will be remove at the same time.

All you need to do just save file as before.

![demo-01](demo.01.gif)

### Format Template

Angular template will be formatted on save.

## Commands

press `F1` then enter `aron: import sort` to trigger sort manually.

press `F1` then enter `aron: import disable` to disable automatical sort.

press `F1` then enter `aron: import enable` to enable automatical sort again.

press `F1` then enter `aron: template format` to trigger template format manually.

press `F1` then enter `aron: template disable` to disable automatical format.

press `F1` then enter `aron: template enable` to enable automatical format.

## Known Issues

Can't recognize mutiply line import like below. Please `aronImportDisable` temporarily. I will try to fix it soon.

```typescript
import {
    Component,
    OnInit,
} from '@angular/core';
```
