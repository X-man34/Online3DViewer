import * as assert from 'assert';
import * as OV from '../../source/engine/main.js';

export default function suite ()
{

describe ('Section Model', function () {
    it ('Default Initialization', function () {
        let settings = new OV.SectionSettings ();
        assert.strictEqual (settings.enabled, false);
        assert.strictEqual (settings.usePartColorCaps, true);
        assert.strictEqual (settings.showPlaneOverlays, false);
        assert.strictEqual (settings.planes.length, 3);
        assert.strictEqual (settings.planes[0].axis, OV.SectionPlaneAxis.X);
        assert.strictEqual (settings.planes[1].axis, OV.SectionPlaneAxis.Y);
        assert.strictEqual (settings.planes[2].axis, OV.SectionPlaneAxis.Z);
        assert.strictEqual (settings.HasActivePlane (), false);
    });

    it ('Clone', function () {
        let settings = new OV.SectionSettings ();
        settings.enabled = true;
        settings.usePartColorCaps = false;
        settings.showPlaneOverlays = true;
        settings.planes[0].enabled = true;
        settings.planes[0].offset = 12.5;
        settings.planes[0].angle1 = 30.0;
        settings.planes[0].angle2 = -15.0;
        settings.planes[0].flipped = true;
        settings.planes[0].showCap = false;
        settings.planes[0].capColor = new OV.RGBColor (1, 2, 3);

        let cloned = settings.Clone ();
        cloned.planes[0].offset = 3.0;
        cloned.planes[0].capColor.r = 10;

        assert.strictEqual (settings.planes[0].offset, 12.5);
        assert.strictEqual (settings.planes[0].angle1, 30.0);
        assert.strictEqual (settings.planes[0].angle2, -15.0);
        assert.strictEqual (cloned.usePartColorCaps, false);
        assert.strictEqual (cloned.showPlaneOverlays, true);
        assert.deepStrictEqual (settings.planes[0].capColor, new OV.RGBColor (1, 2, 3));
        assert.strictEqual (cloned.HasActivePlane (), true);
    });

    it ('Point Clipping', function () {
        let settings = new OV.SectionSettings ();
        settings.enabled = true;
        settings.planes[0].enabled = true;
        settings.planes[0].axis = OV.SectionPlaneAxis.X;
        settings.planes[0].offset = 2.0;

        let planes = OV.CreateSectionPlanes (settings);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 3.0, y : 0.0, z : 0.0 }), true);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 1.0, y : 0.0, z : 0.0 }), false);

        settings.planes[0].flipped = true;
        planes = OV.CreateSectionPlanes (settings);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 1.0, y : 0.0, z : 0.0 }), true);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 3.0, y : 0.0, z : 0.0 }), false);
    });

    it ('Angled Point Clipping', function () {
        let settings = new OV.SectionSettings ();
        settings.enabled = true;
        settings.planes[0].enabled = true;
        settings.planes[0].axis = OV.SectionPlaneAxis.X;
        settings.planes[0].offset = 0.0;
        settings.planes[0].angle1 = 90.0;

        let planes = OV.CreateSectionPlanes (settings);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 0.0, y : 1.0, z : 0.0 }), true);
        assert.strictEqual (OV.IsPointClippedBySectionPlanes (planes, { x : 1.0, y : 0.0, z : 0.0 }), false);
    });
});

}
