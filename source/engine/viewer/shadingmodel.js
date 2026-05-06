import { SubCoord3D } from '../geometry/coord3d.js';
import { ProjectionMode } from '../viewer/camera.js';
import { ShadingType } from '../threejs/threeutils.js';

import * as THREE from 'three';

/**
 * Environment settings object.
 */
export class EnvironmentSettings
{
    /**
     * @param {string[]} textureNames Urls of the environment map images in this order:
     * posx, negx, posy, negy, posz, negz.
     * @param {boolean} backgroundIsEnvMap Use the environment map as background.
     */
    constructor (textureNames, backgroundIsEnvMap)
    {
        this.textureNames = textureNames;
        this.backgroundIsEnvMap = backgroundIsEnvMap;
    }

    /**
     * Creates a clone of the object.
     * @returns {EnvironmentSettings}
     */
    Clone ()
    {
        let textureNames = null;
        if (this.textureNames !== null) {
            textureNames = [];
            for (let textureName of this.textureNames) {
                textureNames.push (textureName);
            }
        }
        return new EnvironmentSettings (textureNames, this.backgroundIsEnvMap);
    }
}

export class ShadingModel
{
    constructor (scene)
    {
        this.scene = scene;

        this.type = ShadingType.Phong;
        this.projectionMode = ProjectionMode.Perspective;
        this.ambientLight = new THREE.AmbientLight (0xffffff, 0.65 * Math.PI);
        this.hemisphereLight = new THREE.HemisphereLight (0xffffff, 0x888888, 0.45 * Math.PI);
        this.directionalLight = new THREE.DirectionalLight (0xffffff, 1.2 * Math.PI);
        this.fillLight = new THREE.DirectionalLight (0xffffff, 0.35 * Math.PI);
        this.lowerFillLight = new THREE.DirectionalLight (0xffffff, 0.45 * Math.PI);
        this.sideFillLight = new THREE.DirectionalLight (0xffffff, 0.3 * Math.PI);
        this.environmentSettings = new EnvironmentSettings (null, false);
        this.environment = null;

        this.scene.add (this.ambientLight);
        this.scene.add (this.hemisphereLight);
        this.scene.add (this.directionalLight);
        this.scene.add (this.fillLight);
        this.scene.add (this.lowerFillLight);
        this.scene.add (this.sideFillLight);
    }

    SetShadingType (type)
    {
        this.type = type;
        this.UpdateShading ();
    }

    SetProjectionMode (projectionMode)
    {
        this.projectionMode = projectionMode;
        this.UpdateShading ();
    }

    UpdateShading ()
    {
        if (this.type === ShadingType.Phong) {
            this.ambientLight.color.set (0xffffff);
            this.ambientLight.intensity = 0.65 * Math.PI;
            this.hemisphereLight.intensity = 0.45 * Math.PI;
            this.directionalLight.color.set (0xffffff);
            this.directionalLight.intensity = 1.2 * Math.PI;
            this.fillLight.intensity = 0.35 * Math.PI;
            this.lowerFillLight.intensity = 0.45 * Math.PI;
            this.sideFillLight.intensity = 0.3 * Math.PI;
            this.scene.environment = null;
        } else if (this.type === ShadingType.Physical) {
            this.ambientLight.color.set (0xffffff);
            this.ambientLight.intensity = 0.35 * Math.PI;
            this.hemisphereLight.intensity = 0.25 * Math.PI;
            this.directionalLight.color.set (0xffffff);
            this.directionalLight.intensity = 1.1 * Math.PI;
            this.fillLight.intensity = 0.45 * Math.PI;
            this.lowerFillLight.intensity = 0.55 * Math.PI;
            this.sideFillLight.intensity = 0.35 * Math.PI;
            this.scene.environment = this.environment;
        }
        if (this.environmentSettings.backgroundIsEnvMap && this.projectionMode === ProjectionMode.Perspective) {
            this.scene.background = this.environment;
        } else {
            this.scene.background = null;
        }
    }

    SetEnvironmentMapSettings (environmentSettings, onLoaded)
    {
        let loader = new THREE.CubeTextureLoader ();
        this.environment = loader.load (environmentSettings.textureNames, (texture) => {
            texture.colorSpace = THREE.LinearSRGBColorSpace;
            onLoaded ();
        });
        this.environmentSettings = environmentSettings;
    }

    UpdateByCamera (camera)
    {
        const lightDir = SubCoord3D (camera.eye, camera.center);
        this.directionalLight.position.set (lightDir.x, lightDir.y, lightDir.z);

        const viewDirection = new THREE.Vector3 (lightDir.x, lightDir.y, lightDir.z).normalize ();
        const upDirection = new THREE.Vector3 (camera.up.x, camera.up.y, camera.up.z).normalize ();
        const sideDirection = new THREE.Vector3 ().crossVectors (viewDirection, upDirection).normalize ();
        const fillDirection = viewDirection.multiplyScalar (0.45).add (sideDirection.multiplyScalar (0.8)).add (upDirection.multiplyScalar (0.35));
        this.fillLight.position.copy (fillDirection);

        const lowerFillDirection = new THREE.Vector3 (lightDir.x, lightDir.y, lightDir.z).normalize ()
            .multiplyScalar (0.35)
            .add (new THREE.Vector3 (camera.up.x, camera.up.y, camera.up.z).normalize ().multiplyScalar (-0.9));
        this.lowerFillLight.position.copy (lowerFillDirection);

        const sideFillDirection = new THREE.Vector3 ().crossVectors (
            new THREE.Vector3 (lightDir.x, lightDir.y, lightDir.z).normalize (),
            new THREE.Vector3 (camera.up.x, camera.up.y, camera.up.z).normalize ()
        ).normalize ().multiplyScalar (-1.0);
        this.sideFillLight.position.copy (sideFillDirection);
    }
}
