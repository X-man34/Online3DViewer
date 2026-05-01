import * as assert from 'assert';
import * as THREE from 'three';
import * as OV from '../../source/engine/main.js';

class TestMeshInstanceId
{
    constructor (key)
    {
        this.key = key;
    }

    IsEqual (rhs)
    {
        return this.key === rhs.key;
    }

    GetKey ()
    {
        return this.key;
    }
}

function CreateUserData (meshInstanceId)
{
    return {
        originalMeshInstance : {
            id : meshInstanceId
        },
        threeMaterials : null
    };
}

function CreateBoxMesh (meshInstanceId, position)
{
    let materials = [];
    for (let i = 0; i < 6; i++) {
        materials.push (new THREE.MeshBasicMaterial ());
    }
    let mesh = new THREE.Mesh (
        new THREE.BoxGeometry (1.0, 1.0, 1.0),
        materials
    );
    mesh.position.copy (position);
    mesh.userData = CreateUserData (meshInstanceId);
    return mesh;
}

function CreateLineMesh (meshInstanceId, position)
{
    let line = new THREE.LineSegments (
        new THREE.BufferGeometry ().setFromPoints ([
            new THREE.Vector3 (0.0, 0.0, 0.0),
            new THREE.Vector3 (1.0, 0.0, 0.0)
        ]),
        [new THREE.LineBasicMaterial ()]
    );
    line.position.copy (position);
    line.userData = CreateUserData (meshInstanceId);
    return line;
}

function CreateViewerModelWithRoot (root)
{
    let viewerModel = new OV.ViewerMainModel (new THREE.Scene ());
    viewerModel.SetMainObject (root);
    return viewerModel;
}

function GetWorldPosition (object)
{
    object.updateWorldMatrix (true, false);
    return new THREE.Vector3 ().setFromMatrixPosition (object.matrixWorld);
}

function AssertVectorEqual (actual, expected)
{
    assert.ok (actual.distanceTo (expected) < 1.0e-8, actual.toArray ().join (',') + ' !== ' + expected.toArray ().join (','));
}

function CreateCamera ()
{
    let camera = new THREE.PerspectiveCamera (45.0, 1.0, 0.1, 100.0);
    camera.position.set (0.0, 0.0, 10.0);
    camera.lookAt (new THREE.Vector3 (0.0, 0.0, 0.0));
    camera.updateMatrixWorld (true);
    return camera;
}

function GetFirstGeneratedEdge (viewerModel)
{
    let result = null;
    viewerModel.EnumerateEdges ((edge) => {
        result = edge;
    });
    return result;
}

function GetFirstStencilCapObject (viewerModel)
{
    let root = viewerModel.sectionCapModel.GetRootObject ();
    let result = null;
    root.traverse ((object) => {
        if (result === null && object.isMesh && object.material.colorWrite === false) {
            result = object;
        }
    });
    return result;
}

export default function suite ()
{

describe ('Viewer Model', function () {
    it ('Component Translation Defaults To Zero', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let viewerModel = new OV.ViewerMainModel (new THREE.Scene ());

        AssertVectorEqual (viewerModel.GetComponentTranslation (meshInstanceId), new THREE.Vector3 (0.0, 0.0, 0.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
    });

    it ('Component Translation Is Stored As A Clone', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);
        let translation = new THREE.Vector3 (1.0, 2.0, 3.0);

        viewerModel.SetComponentTranslation (meshInstanceId, translation);
        translation.set (8.0, 8.0, 8.0);
        let returnedTranslation = viewerModel.GetComponentTranslation (meshInstanceId);
        returnedTranslation.set (9.0, 9.0, 9.0);

        AssertVectorEqual (viewerModel.GetComponentTranslation (meshInstanceId), new THREE.Vector3 (1.0, 2.0, 3.0));
        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (1.0, 2.0, 3.0));
    });

    it ('Zero Component Translation Removes Stored State', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 0.0, 0.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), true);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));

        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (1.0, 0.0, 0.0));
    });

    it ('Component Translation Moves Matching Mesh And Line Objects', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let root = new THREE.Object3D ();
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let line = CreateLineMesh (meshInstanceId, new THREE.Vector3 (-1.0, 0.0, 0.0));
        root.add (mesh);
        root.add (line);
        let viewerModel = CreateViewerModelWithRoot (root);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 3.0, 4.0));

        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (3.0, 3.0, 4.0));
        AssertVectorEqual (GetWorldPosition (line), new THREE.Vector3 (1.0, 3.0, 4.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), true);

        viewerModel.ResetComponentTranslations ();

        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (1.0, 0.0, 0.0));
        AssertVectorEqual (GetWorldPosition (line), new THREE.Vector3 (-1.0, 0.0, 0.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
    });

    it ('Component Translation Only Moves Matching Mesh Instance Ids', function () {
        let movedMeshId = new TestMeshInstanceId ('mesh:1');
        let fixedMeshId = new TestMeshInstanceId ('mesh:2');
        let root = new THREE.Object3D ();
        let movedMesh = CreateBoxMesh (movedMeshId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let fixedMesh = CreateBoxMesh (fixedMeshId, new THREE.Vector3 (5.0, 0.0, 0.0));
        root.add (movedMesh);
        root.add (fixedMesh);
        let viewerModel = CreateViewerModelWithRoot (root);

        viewerModel.SetComponentTranslation (movedMeshId, new THREE.Vector3 (1.0, 2.0, 3.0));

        AssertVectorEqual (GetWorldPosition (movedMesh), new THREE.Vector3 (1.0, 2.0, 3.0));
        AssertVectorEqual (GetWorldPosition (fixedMesh), new THREE.Vector3 (5.0, 0.0, 0.0));
    });

    it ('Component Translation Is Applied In World Space Under Parent Transforms', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let root = new THREE.Object3D ();
        root.position.set (10.0, 0.0, 0.0);
        root.scale.set (2.0, 2.0, 2.0);
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        root.add (mesh);
        let viewerModel = CreateViewerModelWithRoot (root);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (4.0, 0.0, 0.0));

        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (16.0, 0.0, 0.0));
        viewerModel.ResetComponentTranslations ();
        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (12.0, 0.0, 0.0));
    });

    it ('SetMainObject Clears Previous Component Translations', function () {
        let firstMeshId = new TestMeshInstanceId ('mesh:1');
        let secondMeshId = new TestMeshInstanceId ('mesh:2');
        let firstMesh = CreateBoxMesh (firstMeshId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let secondMesh = CreateBoxMesh (secondMeshId, new THREE.Vector3 (5.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (firstMesh);

        viewerModel.SetComponentTranslation (firstMeshId, new THREE.Vector3 (2.0, 0.0, 0.0));
        viewerModel.SetMainObject (secondMesh);

        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
        AssertVectorEqual (viewerModel.GetComponentTranslation (firstMeshId), new THREE.Vector3 (0.0, 0.0, 0.0));
        AssertVectorEqual (GetWorldPosition (secondMesh), new THREE.Vector3 (5.0, 0.0, 0.0));

        viewerModel.SetComponentTranslation (secondMeshId, new THREE.Vector3 (1.0, 0.0, 0.0));
        AssertVectorEqual (GetWorldPosition (secondMesh), new THREE.Vector3 (6.0, 0.0, 0.0));
    });

    it ('Clear Removes Component Translation State', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        viewerModel.Clear ();

        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
        AssertVectorEqual (viewerModel.GetComponentTranslation (meshInstanceId), new THREE.Vector3 (0.0, 0.0, 0.0));
    });

    it ('Bounding Box And Sphere Use Moved Component Positions', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (3.0, 0.0, 0.0));

        let boundingBox = viewerModel.GetBoundingBox (() => {
            return true;
        });
        let boundingSphere = viewerModel.GetBoundingSphere (() => {
            return true;
        });

        AssertVectorEqual (boundingBox.min, new THREE.Vector3 (2.5, -0.5, -0.5));
        AssertVectorEqual (boundingBox.max, new THREE.Vector3 (3.5, 0.5, 0.5));
        AssertVectorEqual (boundingSphere.center, new THREE.Vector3 (3.0, 0.0, 0.0));
    });

    it ('Picking Uses Moved Component Positions', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);
        let camera = CreateCamera ();

        assert.notStrictEqual (viewerModel.GetMeshIntersectionUnderMouse (OV.IntersectionMode.MeshOnly, { x : 50.0, y : 50.0 }, camera, 100.0, 100.0), null);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (5.0, 0.0, 0.0));

        assert.strictEqual (viewerModel.GetMeshIntersectionUnderMouse (OV.IntersectionMode.MeshOnly, { x : 50.0, y : 50.0 }, camera, 100.0, 100.0), null);
    });

    it ('Picking Ignores Hidden Moved Components', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);
        let camera = CreateCamera ();

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (0.0, 0.0, 1.0));
        mesh.visible = false;

        assert.strictEqual (viewerModel.GetMeshIntersectionUnderMouse (OV.IntersectionMode.MeshOnly, { x : 50.0, y : 50.0 }, camera, 100.0, 100.0), null);
    });

    it ('Generated Edges Follow Component Translation And Reset', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);
        viewerModel.SetEdgeSettings (new OV.EdgeSettings (true, new OV.RGBColor (0, 0, 0), 1.0));
        let edge = GetFirstGeneratedEdge (viewerModel);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 0.0, 0.0));

        AssertVectorEqual (GetWorldPosition (edge), new THREE.Vector3 (3.0, 0.0, 0.0));
        viewerModel.ResetComponentTranslations ();
        AssertVectorEqual (GetWorldPosition (edge), new THREE.Vector3 (1.0, 0.0, 0.0));
    });

    it ('Generated Edges Preserve Existing Component Translation When Enabled Later', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 0.0, 0.0));
        viewerModel.SetEdgeSettings (new OV.EdgeSettings (true, new OV.RGBColor (0, 0, 0), 1.0));

        let edge = GetFirstGeneratedEdge (viewerModel);
        AssertVectorEqual (GetWorldPosition (edge), new THREE.Vector3 (3.0, 0.0, 0.0));
    });

    it ('Section Cap Stencil Geometry Follows Moved Component', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let viewerModel = CreateViewerModelWithRoot (mesh);
        let sectionSettings = new OV.SectionSettings ();
        sectionSettings.enabled = true;
        sectionSettings.planes[0].enabled = true;
        sectionSettings.planes[0].axis = OV.SectionPlaneAxis.X;
        sectionSettings.planes[0].offset = 1.0;
        sectionSettings.planes[0].showCap = true;
        viewerModel.SetSectionSettings (sectionSettings);

        let stencil = GetFirstStencilCapObject (viewerModel);
        AssertVectorEqual (GetWorldPosition (stencil), new THREE.Vector3 (1.0, 0.0, 0.0));

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 0.0, 0.0));

        stencil = GetFirstStencilCapObject (viewerModel);
        AssertVectorEqual (GetWorldPosition (stencil), new THREE.Vector3 (3.0, 0.0, 0.0));
    });

    it ('Object Original Positions Are Independent When User Data Is Shared', function () {
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');
        let sharedUserData = CreateUserData (meshInstanceId);
        let root = new THREE.Object3D ();
        let mesh = CreateBoxMesh (meshInstanceId, new THREE.Vector3 (1.0, 0.0, 0.0));
        let line = CreateLineMesh (meshInstanceId, new THREE.Vector3 (-1.0, 0.0, 0.0));
        mesh.userData = sharedUserData;
        line.userData = sharedUserData;
        root.add (mesh);
        root.add (line);
        let viewerModel = CreateViewerModelWithRoot (root);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 0.0, 0.0));
        viewerModel.ResetComponentTranslations ();

        AssertVectorEqual (GetWorldPosition (mesh), new THREE.Vector3 (1.0, 0.0, 0.0));
        AssertVectorEqual (GetWorldPosition (line), new THREE.Vector3 (-1.0, 0.0, 0.0));
    });
});

}
