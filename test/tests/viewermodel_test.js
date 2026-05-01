import * as assert from 'assert';
import * as THREE from 'three';
import * as OV from '../../source/engine/main.js';

class TestMeshInstanceId
{
    constructor (key)
    {
        this.key = key;
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

function GetWorldPosition (object)
{
    object.updateWorldMatrix (true, false);
    return new THREE.Vector3 ().setFromMatrixPosition (object.matrixWorld);
}

export default function suite ()
{

describe ('Viewer Model', function () {
    it ('Component Translation Moves Matching Render Objects', function () {
        let scene = new THREE.Scene ();
        let viewerModel = new OV.ViewerMainModel (scene);
        let meshInstanceId = new TestMeshInstanceId ('mesh:1');

        let root = new THREE.Object3D ();
        let mesh = new THREE.Mesh (
            new THREE.BoxGeometry (1.0, 1.0, 1.0),
            [new THREE.MeshBasicMaterial ()]
        );
        mesh.position.set (1.0, 0.0, 0.0);
        mesh.userData = CreateUserData (meshInstanceId);

        let line = new THREE.LineSegments (
            new THREE.BufferGeometry ().setFromPoints ([
                new THREE.Vector3 (0.0, 0.0, 0.0),
                new THREE.Vector3 (1.0, 0.0, 0.0)
            ]),
            new THREE.LineBasicMaterial ()
        );
        line.position.set (-1.0, 0.0, 0.0);
        line.userData = CreateUserData (meshInstanceId);

        root.add (mesh);
        root.add (line);
        viewerModel.SetMainObject (root);

        viewerModel.SetComponentTranslation (meshInstanceId, new THREE.Vector3 (2.0, 3.0, 4.0));

        assert.deepStrictEqual (GetWorldPosition (mesh), new THREE.Vector3 (3.0, 3.0, 4.0));
        assert.deepStrictEqual (GetWorldPosition (line), new THREE.Vector3 (1.0, 3.0, 4.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), true);

        viewerModel.ResetComponentTranslations ();

        assert.deepStrictEqual (GetWorldPosition (mesh), new THREE.Vector3 (1.0, 0.0, 0.0));
        assert.deepStrictEqual (GetWorldPosition (line), new THREE.Vector3 (-1.0, 0.0, 0.0));
        assert.strictEqual (viewerModel.HasComponentTranslations (), false);
    });
});

}
