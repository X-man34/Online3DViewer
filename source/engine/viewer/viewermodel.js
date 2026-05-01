import { RGBColor } from '../model/color.js';
import { ConvertColorToThreeColor, DisposeThreeObjects, GetLineSegmentsProjectedDistance } from '../threejs/threeutils.js';
import { CreateSectionPlanes, IsPointClippedBySectionPlanes, SectionSettings } from './sectionmodel.js';

import * as THREE from 'three';

const LineThresholdInPixels = 10.0;

export const IntersectionMode =
{
	MeshOnly : 1,
    MeshAndLine : 2
};

export function SetThreeMeshPolygonOffset (mesh, offset)
{
    function SetMaterialsPolygonOffset (materials, offset)
    {
        for (let material of materials) {
            material.polygonOffset = offset;
            material.polygonOffsetUnit = 1;
            material.polygonOffsetFactor = 1;
        }
    }

    SetMaterialsPolygonOffset (mesh.material, offset);
    if (mesh.userData.threeMaterials) {
        SetMaterialsPolygonOffset (mesh.userData.threeMaterials, offset);
    }
}

export class ViewerModel
{
    constructor (scene)
    {
        this.scene = scene;
        this.rootObject = null;
    }

    IsEmpty ()
    {
        return this.rootObject === null;
    }

    SetRootObject (rootObject)
    {
        if (this.rootObject !== null) {
            this.Clear ();
        }
        this.rootObject = rootObject;
        this.scene.add (this.rootObject);
    }

    GetRootObject ()
    {
        return this.rootObject;
    }

    AddObject (object)
    {
        if (this.rootObject === null) {
            let newRootObject = new THREE.Object3D ();
            this.SetRootObject (newRootObject);
        }
        this.rootObject.add (object);
    }

    Traverse (enumerator)
    {
        if (this.rootObject === null) {
            return;
        }
        this.rootObject.traverse ((obj) => {
            enumerator (obj);
        });
    }

    UpdateWorldMatrix ()
    {
        if (this.rootObject !== null) {
            this.rootObject.updateWorldMatrix (true, true);
        }
    }

    Clear ()
    {
        DisposeThreeObjects (this.rootObject);
        this.scene.remove (this.rootObject);
        this.rootObject = null;
    }
}

/**
 * Edge settings object.
 */
export class EdgeSettings
{
    /**
     * @param {boolean} showEdges Show edges.
     * @param {RGBColor} edgeColor Color of the edges.
     * @param {number} edgeThreshold Minimum angle between faces to show edges between them in.
     * The value must be in degrees.
     */
    constructor (showEdges, edgeColor, edgeThreshold)
    {
        this.showEdges = showEdges;
        this.edgeColor = edgeColor;
        this.edgeThreshold = edgeThreshold;
    }

    /**
     * Creates a clone of the object.
     * @returns {EdgeSettings}
     */
    Clone ()
    {
        return new EdgeSettings (this.showEdges, this.edgeColor.Clone (), this.edgeThreshold);
    }
}

export class ViewerMainModel
{
    constructor (scene)
    {
        this.scene = scene;

        this.mainModel = new ViewerModel (this.scene);
        this.edgeModel = new ViewerModel (this.scene);
        this.sectionCapModel = new ViewerModel (this.scene);

        this.edgeSettings = new EdgeSettings (false, new RGBColor (0, 0, 0), 1);
        this.sectionSettings = new SectionSettings ();
        this.sectionPlanes = [];
        this.componentTranslations = new Map ();
        this.hasLines = false;
        this.hasPolygonOffset = false;
    }

    SetMainObject (mainObject)
    {
        this.componentTranslations.clear ();
        this.mainModel.SetRootObject (mainObject);
        this.StoreOriginalObjectPositions ();
        this.hasLines = false;
        this.hasPolygonOffset = false;

        this.EnumerateLines ((line) => {
            this.hasLines = true;
        });

        if (this.edgeSettings.showEdges) {
            this.GenerateEdgeModel ();
        }
        this.UpdateSectionClipping ();
        this.UpdatePolygonOffset ();
    }

    UpdateWorldMatrix ()
    {
        this.mainModel.UpdateWorldMatrix ();
        this.edgeModel.UpdateWorldMatrix ();
    }

    SetEdgeSettings (edgeSettings)
    {
        let needToGenerate = false;
        if (edgeSettings.showEdges && (!this.edgeSettings.showEdges || this.edgeSettings.edgeThreshold !== edgeSettings.edgeThreshold)) {
            needToGenerate = true;
        }

        this.edgeSettings = edgeSettings;

        if (this.mainModel.IsEmpty ()) {
            return;
        }

        if (this.edgeSettings.showEdges) {
            if (needToGenerate) {
                this.ClearEdgeModel ();
                this.GenerateEdgeModel ();
            } else {
                let edgeColor = ConvertColorToThreeColor (this.edgeSettings.edgeColor);
                this.EnumerateEdges ((edge) => {
                    edge.material.color = edgeColor;
                });
            }
        } else {
            this.ClearEdgeModel ();
        }
        this.UpdateSectionClipping ();
    }

    GenerateEdgeModel ()
    {
        let edgeColor = ConvertColorToThreeColor (this.edgeSettings.edgeColor);

        this.UpdateWorldMatrix ();
        this.EnumerateMeshes ((mesh) => {
            let edges = new THREE.EdgesGeometry (mesh.geometry, this.edgeSettings.edgeThreshold);
            let line = new THREE.LineSegments (edges, new THREE.LineBasicMaterial ({
                color: edgeColor
            }));
            line.applyMatrix4 (mesh.matrixWorld);
            line.userData = mesh.userData;
            this.StoreOriginalObjectPosition (line);
            line.visible = mesh.visible;
            this.edgeModel.AddObject (line);
        });

        this.ApplyComponentTranslations ();
        this.UpdateSectionClipping ();
        this.UpdatePolygonOffset ();
    }

    SetSectionSettings (sectionSettings)
    {
        this.sectionSettings = sectionSettings.Clone ();
        this.sectionPlanes = CreateSectionPlanes (this.sectionSettings);
        this.UpdateSectionClipping ();
    }

    GetSectionSettings ()
    {
        return this.sectionSettings.Clone ();
    }

    HasActiveSection ()
    {
        return this.sectionPlanes.length > 0;
    }

    UpdateSectionClipping ()
    {
        let clippingPlanes = this.sectionPlanes.map ((sectionPlane) => {
            return sectionPlane.plane;
        });
        this.EnumerateMeshesAndLines ((mesh) => {
            this.SetObjectClippingPlanes (mesh, clippingPlanes);
        });
        this.EnumerateEdges ((edge) => {
            this.SetObjectClippingPlanes (edge, clippingPlanes);
        });
        this.UpdateSectionCapModel ();
    }

    SetObjectClippingPlanes (object, clippingPlanes)
    {
        function SetMaterialClippingPlanes (materials, clippingPlanes)
        {
            if (!Array.isArray (materials)) {
                materials = [materials];
            }
            for (let material of materials) {
                material.clippingPlanes = clippingPlanes.length === 0 ? null : clippingPlanes;
                material.clipIntersection = false;
                material.needsUpdate = true;
            }
        }

        SetMaterialClippingPlanes (object.material, clippingPlanes);
        if (object.userData.threeMaterials) {
            SetMaterialClippingPlanes (object.userData.threeMaterials, clippingPlanes);
        }
    }

    UpdateSectionCapModel ()
    {
        this.ClearSectionCapModel ();
        if (this.mainModel.IsEmpty () || !this.HasActiveSection ()) {
            return;
        }
        this.UpdateWorldMatrix ();

        let boundingBox = this.GetBoundingBox ((meshUserData) => {
            return true;
        });
        if (boundingBox === null) {
            return;
        }

        let size = new THREE.Vector3 ();
        boundingBox.getSize (size);
        let center = new THREE.Vector3 ();
        boundingBox.getCenter (center);
        let capSize = Math.max (size.x, size.y, size.z) * 4.0;
        if (capSize === 0.0) {
            capSize = 1.0;
        }

        let capRoot = new THREE.Object3D ();
        let clippingPlanes = this.sectionPlanes.map ((sectionPlane) => {
            return sectionPlane.plane;
        });

        for (let sectionPlaneIndex = 0; sectionPlaneIndex < this.sectionPlanes.length; sectionPlaneIndex++) {
            let sectionPlane = this.sectionPlanes[sectionPlaneIndex];
            let otherClippingPlanes = clippingPlanes.filter ((plane) => {
                return plane !== sectionPlane.plane;
            });

            let renderOrderBase = 1000 + sectionPlaneIndex * 100000;
            if (this.sectionSettings.showPlaneOverlays) {
                capRoot.add (this.CreateSectionPlaneOverlay (sectionPlane, capSize, center, renderOrderBase + 99990));
            }

            if (sectionPlane.settings.showCap) {
                let capItemIndex = 0;
                this.EnumerateMeshes ((mesh) => {
                    if (!mesh.visible) {
                        return;
                    }
                    for (let capRenderItem of this.GetCapRenderItems (mesh)) {
                        let renderOrder = renderOrderBase + capItemIndex * 3;
                        capRoot.add (this.CreateStencilMesh (mesh, capRenderItem.geometry, capRenderItem.disposeGeometry, clippingPlanes, THREE.BackSide, THREE.IncrementWrapStencilOp, renderOrder));
                        capRoot.add (this.CreateStencilMesh (mesh, capRenderItem.geometry, false, clippingPlanes, THREE.FrontSide, THREE.DecrementWrapStencilOp, renderOrder));
                        capRoot.add (this.CreateCapPlane (sectionPlane, otherClippingPlanes, capSize, center, renderOrder + 1, capRenderItem.material));
                        capItemIndex += 1;
                    }
                });
            }
        }

        this.sectionCapModel.SetRootObject (capRoot);
    }

    GetCapRenderItems (mesh)
    {
        let meshMaterials = mesh.material;
        if (!Array.isArray (meshMaterials)) {
            meshMaterials = [meshMaterials];
        }

        if (mesh.geometry.groups.length === 0) {
            return [{
                geometry : mesh.geometry,
                disposeGeometry : false,
                material : meshMaterials[0]
            }];
        }

        let renderItems = [];
        for (let group of mesh.geometry.groups) {
            renderItems.push ({
                geometry : this.CreateGeometryGroupReference (mesh.geometry, group),
                disposeGeometry : true,
                material : meshMaterials[group.materialIndex] || meshMaterials[0]
            });
        }
        return renderItems;
    }

    CreateGeometryGroupReference (geometry, group)
    {
        let groupGeometry = new THREE.BufferGeometry ();
        if (geometry.index !== null) {
            groupGeometry.setIndex (geometry.index);
        }
        for (let attributeName of Object.keys (geometry.attributes)) {
            groupGeometry.setAttribute (attributeName, geometry.attributes[attributeName]);
        }
        groupGeometry.setDrawRange (group.start, group.count);
        groupGeometry.boundingBox = geometry.boundingBox;
        groupGeometry.boundingSphere = geometry.boundingSphere;
        return groupGeometry;
    }

    CreateStencilMesh (mesh, geometry, disposeGeometry, clippingPlanes, side, stencilZPass, renderOrder)
    {
        let material = new THREE.MeshBasicMaterial ({
            depthWrite : false,
            depthTest : false,
            colorWrite : false,
            stencilWrite : true,
            stencilFunc : THREE.AlwaysStencilFunc,
            side : side,
            clippingPlanes : clippingPlanes,
            stencilFail : THREE.KeepStencilOp,
            stencilZFail : THREE.KeepStencilOp,
            stencilZPass : stencilZPass
        });
        let stencilMesh = new THREE.Mesh (geometry, material);
        stencilMesh.matrix.copy (mesh.matrixWorld);
        stencilMesh.matrixAutoUpdate = false;
        stencilMesh.frustumCulled = false;
        stencilMesh.renderOrder = renderOrder;
        stencilMesh.userData.disposeGeometry = disposeGeometry;
        return stencilMesh;
    }

    GetCapMaterialColor (sectionPlane, sourceMaterial)
    {
        if (this.sectionSettings.usePartColorCaps && sourceMaterial !== null && sourceMaterial.color !== undefined) {
            return sourceMaterial.color.clone ();
        }
        return ConvertColorToThreeColor (sectionPlane.settings.capColor);
    }

    CreateCapPlane (sectionPlane, clippingPlanes, capSize, center, renderOrder, sourceMaterial)
    {
        let capMaterial = new THREE.MeshBasicMaterial ({
            color : this.GetCapMaterialColor (sectionPlane, sourceMaterial),
            side : THREE.DoubleSide,
            clippingPlanes : clippingPlanes,
            stencilWrite : true,
            stencilRef : 0,
            stencilFunc : THREE.NotEqualStencilFunc,
            stencilFail : THREE.ReplaceStencilOp,
            stencilZFail : THREE.ReplaceStencilOp,
            stencilZPass : THREE.ReplaceStencilOp
        });

        let capPlane = new THREE.Mesh (new THREE.PlaneGeometry (capSize, capSize), capMaterial);
        capPlane.renderOrder = renderOrder;
        capPlane.frustumCulled = false;
        capPlane.userData.disposeGeometry = true;
        capPlane.onAfterRender = (renderer) => {
            renderer.clearStencil ();
        };

        this.SetSectionPlaneObjectPosition (capPlane, sectionPlane, center);
        return capPlane;
    }

    CreateSectionPlaneOverlay (sectionPlane, capSize, center, renderOrder)
    {
        let overlayRoot = new THREE.Object3D ();
        let color = ConvertColorToThreeColor (sectionPlane.settings.capColor);
        let planeGeometry = new THREE.PlaneGeometry (capSize, capSize);
        let planeMaterial = new THREE.MeshBasicMaterial ({
            color : color,
            side : THREE.DoubleSide,
            transparent : true,
            opacity : 0.18,
            depthWrite : false
        });
        let planeMesh = new THREE.Mesh (planeGeometry, planeMaterial);
        planeMesh.renderOrder = renderOrder;
        planeMesh.frustumCulled = false;
        planeMesh.userData.disposeGeometry = true;

        let borderGeometry = new THREE.EdgesGeometry (planeGeometry);
        let borderMaterial = new THREE.LineBasicMaterial ({
            color : color
        });
        let border = new THREE.LineSegments (borderGeometry, borderMaterial);
        border.renderOrder = renderOrder + 1;
        border.frustumCulled = false;
        border.userData.disposeGeometry = true;

        overlayRoot.add (planeMesh);
        overlayRoot.add (border);
        this.SetSectionPlaneObjectPosition (overlayRoot, sectionPlane, center);
        return overlayRoot;
    }

    SetSectionPlaneObjectPosition (object, sectionPlane, center)
    {
        let capPosition = sectionPlane.plane.projectPoint (center, new THREE.Vector3 ());
        object.position.copy (capPosition);
        object.quaternion.setFromUnitVectors (
            new THREE.Vector3 (0.0, 0.0, 1.0),
            sectionPlane.plane.normal
        );
    }

    ClearSectionCapModel ()
    {
        let rootObject = this.sectionCapModel.GetRootObject ();
        if (rootObject === null) {
            return;
        }
        rootObject.traverse ((obj) => {
            if (obj.isMesh || obj.isLineSegments) {
                if (Array.isArray (obj.material)) {
                    for (let material of obj.material) {
                        material.dispose ();
                    }
                } else {
                    obj.material.dispose ();
                }
                if (obj.geometry !== null && obj.userData.disposeGeometry) {
                    obj.geometry.dispose ();
                }
            }
        });
        this.sectionCapModel.scene.remove (rootObject);
        this.sectionCapModel.rootObject = null;
    }

    GetBoundingBox (needToProcess)
    {
        let hasMesh = false;
        let boundingBox = new THREE.Box3 ();
        this.UpdateWorldMatrix ();
        this.EnumerateMeshesAndLines ((mesh) => {
            if (needToProcess (mesh.userData)) {
                boundingBox.union (new THREE.Box3 ().setFromObject (mesh));
                hasMesh = true;
            }
        });
        if (!hasMesh) {
            return null;
        }
        return boundingBox;
    }

    GetBoundingSphere (needToProcess)
    {
        let boundingBox = this.GetBoundingBox (needToProcess);
        if (boundingBox === null) {
            return null;
        }

        let boundingSphere = new THREE.Sphere ();
        boundingBox.getBoundingSphere (boundingSphere);
        return boundingSphere;
    }

    Clear ()
    {
        this.mainModel.Clear ();
        this.ClearEdgeModel ();
        this.ClearSectionCapModel ();
        this.componentTranslations.clear ();
    }

    ClearEdgeModel ()
    {
        if (this.edgeModel.IsEmpty ()) {
            return;
        }

        this.UpdatePolygonOffset ();
        this.edgeModel.Clear ();
    }

    EnumerateMeshes (enumerator)
    {
        this.mainModel.Traverse ((obj) => {
            if (obj.isMesh) {
                enumerator (obj);
            }
        });
    }

    EnumerateLines (enumerator)
    {
        this.mainModel.Traverse ((obj) => {
            if (obj.isLineSegments) {
                enumerator (obj);
            }
        });
    }

    EnumerateMeshesAndLines (enumerator)
    {
        this.mainModel.Traverse ((obj) => {
            if (obj.isMesh) {
                enumerator (obj);
            } else if (obj.isLineSegments) {
                enumerator (obj);
            }
        });
    }

    EnumerateEdges (enumerator)
    {
        this.edgeModel.Traverse ((obj) => {
            if (obj.isLineSegments) {
                enumerator (obj);
            }
        });
    }

    HasLinesOrEdges ()
    {
        return this.hasLines || this.edgeSettings.showEdges;
    }

    StoreOriginalObjectPositions ()
    {
        this.EnumerateMeshesAndLines ((object) => {
            this.StoreOriginalObjectPosition (object);
        });
    }

    StoreOriginalObjectPosition (object)
    {
        object.ovOriginalPosition = object.position.clone ();
    }

    GetComponentTranslationKey (meshInstanceId)
    {
        return meshInstanceId.GetKey ();
    }

    GetComponentTranslation (meshInstanceId)
    {
        let key = this.GetComponentTranslationKey (meshInstanceId);
        if (!this.componentTranslations.has (key)) {
            return new THREE.Vector3 (0.0, 0.0, 0.0);
        }
        return this.componentTranslations.get (key).clone ();
    }

    SetComponentTranslation (meshInstanceId, translation)
    {
        let key = this.GetComponentTranslationKey (meshInstanceId);
        if (translation.lengthSq () < 1.0e-16) {
            this.componentTranslations.delete (key);
        } else {
            this.componentTranslations.set (key, translation.clone ());
        }
        this.ApplyComponentTranslations ();
        this.UpdateSectionCapModel ();
    }

    ResetComponentTranslations ()
    {
        this.componentTranslations.clear ();
        this.ApplyComponentTranslations ();
        this.UpdateSectionCapModel ();
    }

    HasComponentTranslations ()
    {
        return this.componentTranslations.size > 0;
    }

    ApplyComponentTranslations ()
    {
        this.EnumerateMeshesAndLines ((object) => {
            this.ApplyObjectComponentTranslation (object);
        });
        this.EnumerateEdges ((object) => {
            this.ApplyObjectComponentTranslation (object);
        });
        this.UpdateWorldMatrix ();
    }

    ApplyObjectComponentTranslation (object)
    {
        if (object.userData.originalMeshInstance === undefined) {
            return;
        }
        if (object.ovOriginalPosition === undefined) {
            this.StoreOriginalObjectPosition (object);
        }

        let translation = this.GetComponentTranslation (object.userData.originalMeshInstance.id);
        let localTranslation = translation.clone ();
        if (object.parent !== null) {
            object.parent.updateWorldMatrix (true, false);
            let localOrigin = new THREE.Vector3 (0.0, 0.0, 0.0);
            let localTranslated = translation.clone ();
            object.parent.worldToLocal (localOrigin);
            object.parent.worldToLocal (localTranslated);
            localTranslation = localTranslated.sub (localOrigin);
        }
        object.position.copy (object.ovOriginalPosition).add (localTranslation);
        object.updateMatrixWorld (true);
    }

    UpdatePolygonOffset ()
    {
        let needPolygonOffset = this.HasLinesOrEdges ();
        if (needPolygonOffset !== this.hasPolygonOffset) {
            this.EnumerateMeshes ((mesh) => {
                SetThreeMeshPolygonOffset (mesh, needPolygonOffset);
            });
            this.hasPolygonOffset = needPolygonOffset;
        }
    }

    GetMeshIntersectionUnderMouse (intersectionMode, mouseCoords, camera, width, height)
    {
        if (this.mainModel.IsEmpty ()) {
            return null;
        }

        if (mouseCoords.x < 0.0 || mouseCoords.x > width || mouseCoords.y < 0.0 || mouseCoords.y > height) {
            return null;
        }

        let mousePos = new THREE.Vector2 ();
        mousePos.x = (mouseCoords.x / width) * 2 - 1;
        mousePos.y = -(mouseCoords.y / height) * 2 + 1;

        let raycaster = new THREE.Raycaster ();
        raycaster.setFromCamera (mousePos, camera);
        raycaster.params.Line.threshold = 10.0;

        let iSectObjects = raycaster.intersectObject (this.mainModel.GetRootObject (), true);
        for (let i = 0; i < iSectObjects.length; i++) {
            let iSectObject = iSectObjects[i];
            if (!iSectObject.object.visible) {
                continue;
            }
            if (IsPointClippedBySectionPlanes (this.sectionPlanes, iSectObject.point)) {
                continue;
            }
            if (iSectObject.object.isMesh) {
                return iSectObject;
            } else if (iSectObject.object.isLineSegments) {
                if (intersectionMode === IntersectionMode.MeshOnly) {
                    continue;
                }
                let distance = GetLineSegmentsProjectedDistance (camera, width, height, iSectObject.object, mouseCoords);
                if (distance > LineThresholdInPixels) {
                    continue;
                }
                return iSectObject;
            }
        }

        return null;
    }
}
