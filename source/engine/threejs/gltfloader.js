import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { Direction } from '../geometry/geometry.js';
import { Coord3D } from '../geometry/coord3d.js';
import { FileSource } from '../io/fileutils.js';
import { MeshInstanceId } from '../model/meshinstance.js';
import { MaterialType, MaterialSource } from '../model/material.js';
import { ImportErrorCode } from '../import/importer.js';
import { Unit } from '../model/unit.js';

// --- Lightweight wrappers that satisfy the OV model API surface used by the navigator/sidebar ---

class GltfFakeMesh {
    constructor (name) {
        this._name = name;
    }

    GetName () { return this._name; }
}

class GltfFakeNode {
    constructor (id, name) {
        this._id = id;
        this._name = name;
        this._children = [];
        this._meshIndices = [];
    }

    GetId () { return this._id; }
    GetName () { return this._name; }
    GetChildNodes () { return this._children; }
    GetMeshIndices () { return this._meshIndices; }
    ChildNodeCount () { return this._children.length; }
    MeshIndexCount () { return this._meshIndices.length; }
    IsMeshNode () { return this._children.length === 0 && this._meshIndices.length > 0; }
}

class GltfFakeMeshInstance {
    constructor (id, nodeName, meshName, geometry) {
        this.id = id;
        this.node = { GetName : () => nodeName };
        this.mesh = { GetName : () => meshName };
        this._geometry = geometry;
    }

    GetId () { return this.id; }
    GetName () { return this.mesh.GetName (); }

    VertexCount () {
        const pos = this._geometry.attributes.position;
        return pos ? pos.count : 0;
    }

    TriangleCount () {
        if (this._geometry.index) {
            return Math.floor (this._geometry.index.count / 3);
        }
        const pos = this._geometry.attributes.position;
        return pos ? Math.floor (pos.count / 3) : 0;
    }

    LineSegmentCount () { return 0; }
    PropertyGroupCount () { return 0; }

    EnumerateVertices (onVertex) {
        const pos = this._geometry.attributes.position;
        if (!pos) {
            return;
        }
        for (let i = 0; i < pos.count; i++) {
            onVertex (new Coord3D (pos.getX (i), pos.getY (i), pos.getZ (i)));
        }
    }

    EnumerateTriangleVertexIndices () {}
    EnumerateTriangleVertices () {}
}

class GltfFakeModel {
    constructor () {
        this._rootNode = null;
        this._meshes = [];
        this._meshInstances = new Map ();
        this._materials = [];
        this._threeScene = null;
    }

    GetRootNode () { return this._rootNode; }
    GetMesh (index) { return this._meshes[index]; }
    GetMeshInstance (id) { return this._meshInstances.get (id.GetKey ()) || null; }
    MaterialCount () { return this._materials.length; }
    GetMaterial (index) { return this._materials[index]; }
    GetUnit () { return Unit.Unknown; }

    VertexCount () {
        let total = 0;
        this._threeScene.traverse ((obj) => {
            if (obj.isMesh) {
                const pos = obj.geometry.attributes.position;
                if (pos) {
                    total += pos.count;
                }
            }
        });
        return total;
    }

    TriangleCount () {
        let total = 0;
        this._threeScene.traverse ((obj) => {
            if (obj.isMesh) {
                const geo = obj.geometry;
                if (geo.index) {
                    total += Math.floor (geo.index.count / 3);
                } else if (geo.attributes.position) {
                    total += Math.floor (geo.attributes.position.count / 3);
                }
            }
        });
        return total;
    }

    LineSegmentCount () { return 0; }
    PropertyGroupCount () { return 0; }

    EnumerateVertices (onVertex) {
        this._threeScene.traverse ((obj) => {
            if (!obj.isMesh) {
                return;
            }
            const pos = obj.geometry.attributes.position;
            if (!pos) {
                return;
            }
            for (let i = 0; i < pos.count; i++) {
                onVertex (new Coord3D (pos.getX (i), pos.getY (i), pos.getZ (i)));
            }
        });
    }

    EnumerateTriangleVertexIndices () {}
    EnumerateTriangleVertices () {}
}

// --- Loader ---

export class GltfNativeLoader {
    constructor () {
        this._inProgress = false;
        this._objectUrl = null;
    }

    InProgress () {
        return this._inProgress;
    }

    LoadModel (inputFiles, callbacks) {
        if (this._inProgress) {
            return;
        }

        this._inProgress = true;
        this._RevokeObjectUrl ();

        const inputFile = inputFiles[0];
        callbacks.onLoadStart ();

        const loader = new GLTFLoader ();

        const dracoLoader = new DRACOLoader ();
        dracoLoader.setDecoderPath ('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
        loader.setDRACOLoader (dracoLoader);

        let url;
        if (inputFile.source === FileSource.Url) {
            url = inputFile.data;
        } else {
            this._objectUrl = URL.createObjectURL (inputFile.data);
            url = this._objectUrl;
        }

        loader.load (
            url,
            (gltf) => {
                callbacks.onVisualizationStart ();
                const importResult = this._BuildImportResult (gltf, inputFile.name);
                callbacks.onModelFinished (importResult, importResult._threeScene);
                this._inProgress = false;
            },
            null,
            (error) => {
                callbacks.onLoadError ({
                    mainFile : inputFile.name,
                    code : ImportErrorCode.ImportFailed,
                    message : String (error)
                });
                this._inProgress = false;
            }
        );
    }

    _BuildImportResult (gltf, fileName) {
        const scene = gltf.scene;
        const model = new GltfFakeModel ();
        model._threeScene = scene;

        // --- Collect unique materials ---
        const materialIndexMap = new Map ();
        scene.traverse ((obj) => {
            if (!obj.isMesh) {
                return;
            }
            const mats = Array.isArray (obj.material) ? obj.material : [obj.material];
            for (const mat of mats) {
                if (!mat || materialIndexMap.has (mat.uuid)) {
                    continue;
                }
                const index = materialIndexMap.size;
                materialIndexMap.set (mat.uuid, index);
                model._materials.push (this._BuildMaterialDescriptor (mat));
            }
        });

        // --- Build node tree & assign userData ---
        let nodeIdCounter = 0;
        const rootNode = new GltfFakeNode (nodeIdCounter++, '');
        model._rootNode = rootNode;

        const traverseObject = (threeObj, fakeParentNode) => {
            if (threeObj.isMesh) {
                const meshNodeId = nodeIdCounter++;
                const meshNode = new GltfFakeNode (meshNodeId, threeObj.name);
                const meshIndex = model._meshes.length;

                model._meshes.push (new GltfFakeMesh (threeObj.name || `Mesh ${meshIndex}`));
                meshNode._meshIndices.push (meshIndex);
                fakeParentNode._children.push (meshNode);

                const meshInstanceId = new MeshInstanceId (meshNodeId, meshIndex);

                const mats = Array.isArray (threeObj.material) ? threeObj.material : [threeObj.material];
                const matIndices = mats
                    .filter ((m) => m && materialIndexMap.has (m.uuid))
                    .map ((m) => materialIndexMap.get (m.uuid));

                const fakeInstance = new GltfFakeMeshInstance (
                    meshInstanceId,
                    fakeParentNode._name || 'Root',
                    threeObj.name || `Mesh ${meshIndex}`,
                    threeObj.geometry
                );

                model._meshInstances.set (meshInstanceId.GetKey (), fakeInstance);

                threeObj.userData.originalMeshInstance = fakeInstance;
                threeObj.userData.originalMaterials = matIndices;
                threeObj.userData.threeMaterials = null;
            } else {
                const nodeId = nodeIdCounter++;
                const fakeNode = new GltfFakeNode (nodeId, threeObj.name || '');
                fakeParentNode._children.push (fakeNode);

                for (const child of threeObj.children) {
                    traverseObject (child, fakeNode);
                }
            }
        };

        for (const child of scene.children) {
            traverseObject (child, rootNode);
        }

        return {
            model : model,
            mainFile : fileName,
            upVector : Direction.Y,
            usedFiles : [fileName],
            missingFiles : [],
            _threeScene : scene
        };
    }

    _BuildMaterialDescriptor (threeMat) {
        const color = threeMat.color
            ? { r : threeMat.color.r, g : threeMat.color.g, b : threeMat.color.b, Clone () { return { ...this }; } }
            : { r : 0.8, g : 0.8, b : 0.8, Clone () { return { ...this }; } };

        return {
            name : threeMat.name || '',
            color : color,
            type : MaterialType.Physical,
            source : MaterialSource.Model,
            vertexColors : threeMat.vertexColors || false,
            metalness : threeMat.metalness !== undefined ? threeMat.metalness : 0,
            roughness : threeMat.roughness !== undefined ? threeMat.roughness : 1,
        };
    }

    _RevokeObjectUrl () {
        if (this._objectUrl !== null) {
            URL.revokeObjectURL (this._objectUrl);
            this._objectUrl = null;
        }
    }

    Destroy () {
        this._RevokeObjectUrl ();
    }
}

export function IsGltfInputFiles (inputFiles) {
    if (inputFiles.length === 0) {
        return false;
    }
    const name = inputFiles[0].name.toLowerCase ();
    return name.endsWith ('.glb') || name.endsWith ('.gltf');
}
