/********************************************************************************
 * Copyright (c) 2023 CrossBreeze.
 ********************************************************************************/

import { AstNode, CstNode, findNodeForProperty, NameProvider } from 'langium';
import { CrossModelServices } from './cross-model-module.js';
import { UNKNOWN_PROJECT_REFERENCE } from './cross-model-package-manager.js';
import { findDocument } from './util/ast-util.js';

export const ID_PROPERTY = 'id';

export type IdentifiedAstNode = AstNode & {
   [ID_PROPERTY]: string;
};

export function hasId(node?: AstNode): node is IdentifiedAstNode {
   return !!node && ID_PROPERTY in node && typeof node[ID_PROPERTY] === 'string';
}

export function getId(node?: AstNode): string | undefined {
   return hasId(node) ? node[ID_PROPERTY] : undefined;
}

export interface IdProvider extends NameProvider {
   getNodeId(node?: AstNode): string | undefined;
   getLocalId(node?: AstNode): string | undefined;
   getExternalId(node?: AstNode): string | undefined;
}

/**
 * A name provider that returns the fully qualified name of a node by default but also exposes methods to get other names:
 * - The local name is just the name of the node itself if it has a name.
 * - The qualified name / document-local name is the name of the node itself plus all it's named parents within the document
 * - The fully qualified is the package name plus the document-local name.
 */
export class DefaultIdProvider implements NameProvider, IdProvider {
   constructor(
      protected services: CrossModelServices,
      protected packageManager = services.shared.workspace.PackageManager
   ) {}

   /**
    * Returns the direct name of the node if it has one.
    *
    * @param node node
    * @returns direct, local name of the node if available
    */
   getNodeId(node?: AstNode): string | undefined {
      return getId(node);
   }

   /**
    * Returns the qualified name / document-local name, i.e., the local name of the node plus the local name of all it's named
    * parents within the document.
    *
    * @param node node
    * @returns qualified, document-local name
    */
   getLocalId(node?: AstNode): string | undefined {
      if (!node) {
         return undefined;
      }
      let id = this.getNodeId(node);
      if (!id) {
         return undefined;
      }
      let parent = node.$container;
      while (parent) {
         const parentId = this.getNodeId(parent);
         if (parentId) {
            id = parentId + '.' + id;
         }
         parent = parent.$container;
      }
      return id;
   }

   /**
    * Returns the fully-qualified / package-local name, i.e., the package name plus the document-local name.
    *
    * @param node node
    * @param packageName package name
    * @returns fully qualified, package-local name
    */
   getExternalId(node?: AstNode, packageName = this.getPackageName(node)): string | undefined {
      const localId = this.getLocalId(node);
      if (!localId) {
         return undefined;
      }
      return packageName + '/' + localId;
   }

   getPackageName(node?: AstNode): string {
      return !node
         ? UNKNOWN_PROJECT_REFERENCE
         : this.packageManager.getPackageInfoByDocument(findDocument(node))?.referenceName ?? UNKNOWN_PROJECT_REFERENCE;
   }

   getName(node?: AstNode): string | undefined {
      return node ? this.getExternalId(node) : undefined;
   }

   getNameNode(node: AstNode): CstNode | undefined {
      return findNodeForProperty(node.$cstNode, ID_PROPERTY);
   }
}
