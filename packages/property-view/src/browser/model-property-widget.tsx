/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/

import { Message, ReactWidget } from '@theia/core/lib/browser';
import * as React from '@theia/core/shared/react';
import { PropertyDataService } from '@theia/property-view/lib/browser/property-data-service';
import { PropertyViewContentWidget } from '@theia/property-view/lib/browser/property-view-content-widget';

import { ModelService } from '@crossbreeze/model-service/lib/common';
import { CrossModelRoot, UpdateClientOperation, isDiagramNodeEntity } from '@crossbreeze/protocol';
import { IActionDispatcher } from '@eclipse-glsp/client';
import { GLSPDiagramWidget, GlspSelection } from '@eclipse-glsp/theia-integration';
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { inject, injectable } from '@theia/core/shared/inversify';
import { App } from './react-components/App';

@injectable()
export class ModelPropertyWidget extends ReactWidget implements PropertyViewContentWidget {
    static readonly ID = 'attribute-property-view';
    static readonly LABEL = 'Model property widget';

    @inject(ModelService) protected modelService: ModelService;
    @inject(ApplicationShell) protected shell: ApplicationShell;

    protected model: CrossModelRoot | undefined;
    protected uri: string;

    constructor() {
        super();
        this.id = ModelPropertyWidget.ID;
        this.title.label = ModelPropertyWidget.LABEL;
        this.title.caption = ModelPropertyWidget.LABEL;
        this.title.closable = false;
        this.node.tabIndex = 0;

        this.saveModel = this.saveModel.bind(this);
        this.updateModel = this.updateModel.bind(this);
    }

    async updatePropertyViewContent(propertyDataService?: PropertyDataService, selection?: GlspSelection | undefined): Promise<void> {
        this.model = undefined;

        if (propertyDataService) {
            try {
                const selectionData = await propertyDataService.providePropertyData(selection);
                if (isDiagramNodeEntity(selectionData)) {
                    this.model = selectionData.model;
                    this.uri = selectionData.uri;
                }
            } catch (error) {
                this.model = undefined;
            }
        }

        this.update();
    }

    async saveModel(): Promise<void> {
        if (this.model === undefined || this.uri === undefined) {
            throw new Error('Cannot save undefined model');
        }

        const updated = await this.modelService.update(this.uri, this.model);
        await this.modelService.save(this.uri, updated);
        this.actionDispatcher?.dispatch(UpdateClientOperation.create());
    }

    protected async updateModel(model: CrossModelRoot): Promise<void> {
        this.model = model;
    }

    protected render(): React.ReactNode {
        if (this.model) {
            const props = {
                model: this.model,
                saveModel: this.saveModel,
                updateModel: this.updateModel
            };

            return <App {...props} />;
        }
    }

    protected override onActivateRequest(msg: Message): void {
        super.onActivateRequest(msg);
        this.node.focus();
    }

    protected getDiagramWidget(): GLSPDiagramWidget | undefined {
        for (const widget of this.shell.widgets) {
            if (widget instanceof GLSPDiagramWidget) {
                return widget;
            }
        }
        return undefined;
    }

    protected get actionDispatcher(): IActionDispatcher | undefined {
        const widget = this.getDiagramWidget();

        if (widget instanceof GLSPDiagramWidget) {
            return widget.actionDispatcher;
        }
        return undefined;
    }
}
