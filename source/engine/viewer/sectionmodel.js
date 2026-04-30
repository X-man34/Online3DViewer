import { RGBColor } from '../model/color.js';
import { DegRad } from '../geometry/geometry.js';

import * as THREE from 'three';

export const SectionPlaneAxis =
{
    X : 'x',
    Y : 'y',
    Z : 'z'
};

export class SectionPlaneSettings
{
    constructor (axis)
    {
        this.enabled = false;
        this.axis = axis;
        this.offset = 0.0;
        this.angle1 = 0.0;
        this.angle2 = 0.0;
        this.flipped = false;
        this.showCap = true;
        this.capColor = new RGBColor (255, 170, 0);
    }

    Clone ()
    {
        let cloned = new SectionPlaneSettings (this.axis);
        cloned.enabled = this.enabled;
        cloned.offset = this.offset;
        cloned.angle1 = this.angle1;
        cloned.angle2 = this.angle2;
        cloned.flipped = this.flipped;
        cloned.showCap = this.showCap;
        cloned.capColor = this.capColor.Clone ();
        return cloned;
    }
}

export class SectionSettings
{
    constructor ()
    {
        this.enabled = false;
        this.usePartColorCaps = true;
        this.showPlaneOverlays = false;
        this.planes = [
            new SectionPlaneSettings (SectionPlaneAxis.X),
            new SectionPlaneSettings (SectionPlaneAxis.Y),
            new SectionPlaneSettings (SectionPlaneAxis.Z)
        ];
    }

    Clone ()
    {
        let cloned = new SectionSettings ();
        cloned.enabled = this.enabled;
        cloned.usePartColorCaps = this.usePartColorCaps;
        cloned.showPlaneOverlays = this.showPlaneOverlays;
        cloned.planes = this.planes.map ((plane) => {
            return plane.Clone ();
        });
        return cloned;
    }

    HasActivePlane ()
    {
        if (!this.enabled) {
            return false;
        }
        for (let plane of this.planes) {
            if (plane.enabled) {
                return true;
            }
        }
        return false;
    }
}

export function GetSectionPlaneNormal (planeSettings)
{
    function RotateNormal (normal, axis1, angle1, axis2, angle2)
    {
        normal.applyAxisAngle (axis1, angle1 * DegRad);
        normal.applyAxisAngle (axis2, angle2 * DegRad);
        return normal.normalize ();
    }

    let normal = null;
    if (planeSettings.axis === SectionPlaneAxis.X) {
        normal = RotateNormal (
            new THREE.Vector3 (1.0, 0.0, 0.0),
            new THREE.Vector3 (0.0, 0.0, 1.0),
            planeSettings.angle1,
            new THREE.Vector3 (0.0, 1.0, 0.0),
            planeSettings.angle2
        );
    } else if (planeSettings.axis === SectionPlaneAxis.Y) {
        normal = RotateNormal (
            new THREE.Vector3 (0.0, 1.0, 0.0),
            new THREE.Vector3 (0.0, 0.0, 1.0),
            -planeSettings.angle1,
            new THREE.Vector3 (1.0, 0.0, 0.0),
            planeSettings.angle2
        );
    } else {
        normal = RotateNormal (
            new THREE.Vector3 (0.0, 0.0, 1.0),
            new THREE.Vector3 (0.0, 1.0, 0.0),
            planeSettings.angle1,
            new THREE.Vector3 (1.0, 0.0, 0.0),
            -planeSettings.angle2
        );
    }
    if (planeSettings.flipped) {
        normal.multiplyScalar (-1.0);
    }
    return normal;
}

export function GetSectionPlanePoint (planeSettings)
{
    if (planeSettings.axis === SectionPlaneAxis.X) {
        return new THREE.Vector3 (planeSettings.offset, 0.0, 0.0);
    } else if (planeSettings.axis === SectionPlaneAxis.Y) {
        return new THREE.Vector3 (0.0, planeSettings.offset, 0.0);
    }
    return new THREE.Vector3 (0.0, 0.0, planeSettings.offset);
}

export function GetSectionPlaneConstant (planeSettings)
{
    let normal = GetSectionPlaneNormal (planeSettings);
    let point = GetSectionPlanePoint (planeSettings);
    return -normal.dot (point);
}

export function CreateSectionPlane (planeSettings)
{
    let normal = GetSectionPlaneNormal (planeSettings);
    return new THREE.Plane (
        normal,
        GetSectionPlaneConstant (planeSettings)
    );
}

export function CreateSectionPlanes (sectionSettings)
{
    let planes = [];
    if (!sectionSettings.enabled) {
        return planes;
    }
    for (let planeSettings of sectionSettings.planes) {
        if (planeSettings.enabled) {
            planes.push ({
                settings : planeSettings,
                plane : CreateSectionPlane (planeSettings)
            });
        }
    }
    return planes;
}

export function IsPointClippedBySectionPlanes (sectionPlanes, point)
{
    for (let sectionPlane of sectionPlanes) {
        if (sectionPlane.plane.distanceToPoint (point) > 1.0e-8) {
            return true;
        }
    }
    return false;
}
