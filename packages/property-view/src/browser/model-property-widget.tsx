/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/

import { ApplicationShell, ShouldSaveDialog } from '@theia/core/lib/browser';
import { PropertyDataService } from '@theia/property-view/lib/browser/property-data-service';
import { PropertyViewContentWidget } from '@theia/property-view/lib/browser/property-view-content-widget';

import { CrossModelWidget } from '@crossbreeze/core/lib/browser';
import { CrossModelRoot, RenderProps } from '@crossbreeze/protocol';
import { GLSPDiagramWidget, GlspSelection, getDiagramWidget } from '@eclipse-glsp/theia-integration';
import { inject, injectable } from '@theia/core/shared/inversify';
import * as deepEqual from 'fast-deep-equal';
import { PropertiesRenderData } from './model-data-service';

@injectable()
export class ModelPropertyWidget extends CrossModelWidget implements PropertyViewContentWidget {
   @inject(ApplicationShell) protected shell: ApplicationShell;

   protected renderData?: PropertiesRenderData;

   constructor() {
      super();
      this.node.tabIndex = 0;
      this.node.style.height = '100%';
   }

   async updatePropertyViewContent(propertyDataService?: PropertyDataService, selection?: GlspSelection | undefined): Promise<void> {
      const activeWidget = getDiagramWidget(this.shell);
      if (activeWidget?.options.uri === this.model?.uri.toString() && this.model?.uri.toString() !== selection?.sourceUri) {
         // only react to selection of active widget
         return;
      }
      if (propertyDataService) {
         const renderData = (await propertyDataService.providePropertyData(selection)) as PropertiesRenderData | undefined;
         if (this.model?.uri.toString() !== renderData?.uri || !deepEqual(this.renderData, renderData)) {
            this.renderData = renderData;
            this.setModel(renderData?.uri);
         }
      } else {
         this.renderData = undefined;
         this.setModel();
      }
   }

   protected override getRenderProperties(root: CrossModelRoot): RenderProps {
      return this.renderData?.renderProps ?? super.getRenderProperties(root);
   }

   protected override async closeModel(uri: string): Promise<void> {
      if (this.model && this.dirty) {
         const toSave = this.model;
         this.model = undefined;
         const shouldSave = await new ShouldSaveDialog(this).open();
         if (shouldSave) {
            await this.saveModel(toSave);
         }
      }
      super.closeModel(uri);
   }

   protected getDiagramWidget(): GLSPDiagramWidget | undefined {
      for (const widget of this.shell.widgets) {
         if (widget instanceof GLSPDiagramWidget) {
            return widget;
         }
      }
      return undefined;
   }

   protected override focusInput(): void {
      // do nothing, we properties are based on selection so we do not want to steal focus
   }
}
