import { Loc } from '../engine/core/localization.js';
import { RGBColor } from '../engine/model/color.js';
import { AddDiv, AddDomElement, ClearDomElement } from '../engine/viewer/domutils.js';
import { SectionPlaneAxis, SectionSettings } from '../engine/viewer/sectionmodel.js';
import { AddCheckbox, AddRangeSlider, AddSelect, AddSvgIconElement } from './utils.js';

function GetAxisIndex (axis)
{
    if (axis === SectionPlaneAxis.X) {
        return 0;
    } else if (axis === SectionPlaneAxis.Y) {
        return 1;
    }
    return 2;
}

function GetAxisFromIndex (index)
{
    if (index === 0) {
        return SectionPlaneAxis.X;
    } else if (index === 1) {
        return SectionPlaneAxis.Y;
    }
    return SectionPlaneAxis.Z;
}

export function CreateDefaultSectionSettings (boundingBox)
{
    function GetCenter (axis)
    {
        if (boundingBox === null) {
            return 0.0;
        }
        if (axis === SectionPlaneAxis.X) {
            return (boundingBox.min.x + boundingBox.max.x) / 2.0;
        } else if (axis === SectionPlaneAxis.Y) {
            return (boundingBox.min.y + boundingBox.max.y) / 2.0;
        }
        return (boundingBox.min.z + boundingBox.max.z) / 2.0;
    }

    let settings = new SectionSettings ();
    settings.enabled = true;
    for (let i = 0; i < settings.planes.length; i++) {
        let plane = settings.planes[i];
        plane.enabled = (i === 0);
        plane.offset = GetCenter (plane.axis);
        plane.flipped = false;
        plane.angle1 = 0.0;
        plane.angle2 = 0.0;
        plane.showCap = true;
        plane.capColor = new RGBColor (255, 170, 0);
    }
    return settings;
}

export class SectionViewPanel
{
    constructor (parentDiv, settings, boundingBox, callbacks)
    {
        this.parentDiv = parentDiv;
        this.settings = settings.Clone ();
        this.boundingBox = boundingBox;
        this.callbacks = callbacks;
        this.planeRows = [];

        this.Init ();
    }

    Init ()
    {
        ClearDomElement (this.parentDiv);
        AddDiv (this.parentDiv, 'ov_sidebar_title', Loc ('Section View'));

        let buttonRow = AddDiv (this.parentDiv, 'ov_section_button_row');
        this.AddIconButton (buttonRow, 'ov_section_button', Loc ('Apply'), 'check', () => {
            this.callbacks.onApply (this.settings.Clone ());
        });
        this.AddIconButton (buttonRow, 'ov_section_button outline', Loc ('Cancel'), 'close', () => {
            this.callbacks.onCancel ();
        });
        this.AddIconButton (buttonRow, 'ov_section_button outline', Loc ('Reset'), 'reset', () => {
            this.settings = CreateDefaultSectionSettings (this.boundingBox);
            this.Init ();
            this.OnChanged ();
        });

        for (let i = 0; i < this.settings.planes.length; i++) {
            this.AddPlaneControls (i);
        }

        this.OnChanged ();
    }

    AddIconButton (parentDiv, className, title, icon, onClick)
    {
        let button = AddDiv (parentDiv, 'ov_button ' + className);
        button.setAttribute ('title', title);
        button.setAttribute ('alt', title);
        if (icon === 'close') {
            AddSvgIconElement (button, 'close');
        } else if (icon === 'check') {
            AddDomElement (button, 'span', 'ov_section_symbol_icon', '✓');
        } else if (icon === 'reset') {
            AddDomElement (button, 'span', 'ov_section_symbol_icon', '↺');
        }
        button.addEventListener ('click', onClick);
        return button;
    }

    AddPlaneControls (planeIndex)
    {
        let planeSettings = this.settings.planes[planeIndex];
        let sectionDiv = AddDiv (this.parentDiv, 'ov_section_plane');

        let titleRow = AddDiv (sectionDiv, 'ov_section_row');
        let enabledCheckbox = AddCheckbox (titleRow, 'section_plane_' + planeIndex.toString (), Loc ('Section') + ' ' + (planeIndex + 1).toString (), planeSettings.enabled, () => {
            planeSettings.enabled = enabledCheckbox.checked;
            this.OnChanged ();
        });

        let axisRow = AddDiv (sectionDiv, 'ov_section_row');
        AddDiv (axisRow, 'ov_section_label', Loc ('Axis'));
        AddSelect (axisRow, ['X', 'Y', 'Z'], GetAxisIndex (planeSettings.axis), (selectedIndex) => {
            planeSettings.axis = GetAxisFromIndex (selectedIndex);
            this.UpdateOffsetControls (planeIndex);
            this.OnChanged ();
        });

        let offsetRow = AddDiv (sectionDiv, 'ov_section_row');
        AddDiv (offsetRow, 'ov_section_label', Loc ('Offset'));
        let offsetSlider = AddRangeSlider (offsetRow, 0, 1);
        let offsetInput = AddDomElement (offsetRow, 'input', 'ov_section_number');
        offsetInput.setAttribute ('type', 'number');
        offsetInput.addEventListener ('input', () => {
            let offset = parseFloat (offsetInput.value);
            if (isNaN (offset)) {
                return;
            }
            planeSettings.offset = offset;
            offsetSlider.value = offset.toString ();
            this.OnChanged ();
        });
        offsetSlider.addEventListener ('input', () => {
            planeSettings.offset = parseFloat (offsetSlider.value);
            offsetInput.value = this.FormatOffset (planeSettings.offset);
            this.OnChanged ();
        });

        this.AddAngleControls (sectionDiv, planeSettings, 'angle1', Loc ('Angle 1'));
        this.AddAngleControls (sectionDiv, planeSettings, 'angle2', Loc ('Angle 2'));

        let flipRow = AddDiv (sectionDiv, 'ov_section_row');
        let flipButton = AddDiv (flipRow, 'ov_button outline ov_section_small_button', Loc ('Flip'));
        flipButton.addEventListener ('click', () => {
            planeSettings.flipped = !planeSettings.flipped;
            this.OnChanged ();
        });
        let capCheckbox = AddCheckbox (flipRow, 'section_cap_' + planeIndex.toString (), Loc ('Show Cap'), planeSettings.showCap, () => {
            planeSettings.showCap = capCheckbox.checked;
            this.OnChanged ();
        });

        this.planeRows[planeIndex] = {
            offsetSlider : offsetSlider,
            offsetInput : offsetInput
        };
        this.UpdateOffsetControls (planeIndex);
    }

    AddAngleControls (sectionDiv, planeSettings, propertyName, title)
    {
        let angleRow = AddDiv (sectionDiv, 'ov_section_row');
        AddDiv (angleRow, 'ov_section_label', title);
        let angleSlider = AddRangeSlider (angleRow, -180, 180);
        angleSlider.step = '1';
        angleSlider.value = planeSettings[propertyName].toString ();
        let angleInput = AddDomElement (angleRow, 'input', 'ov_section_number');
        angleInput.setAttribute ('type', 'number');
        angleInput.setAttribute ('min', '-180');
        angleInput.setAttribute ('max', '180');
        angleInput.setAttribute ('step', '1');
        angleInput.value = planeSettings[propertyName].toString ();

        angleInput.addEventListener ('input', () => {
            let angle = parseFloat (angleInput.value);
            if (isNaN (angle)) {
                return;
            }
            planeSettings[propertyName] = angle;
            angleSlider.value = angle.toString ();
            this.OnChanged ();
        });
        angleSlider.addEventListener ('input', () => {
            planeSettings[propertyName] = parseFloat (angleSlider.value);
            angleInput.value = planeSettings[propertyName].toString ();
            this.OnChanged ();
        });
    }

    UpdateOffsetControls (planeIndex)
    {
        let planeSettings = this.settings.planes[planeIndex];
        let range = this.GetAxisRange (planeSettings.axis);
        let row = this.planeRows[planeIndex];
        let step = Math.max ((range.max - range.min) / 1000.0, 0.001);
        row.offsetSlider.min = range.min.toString ();
        row.offsetSlider.max = range.max.toString ();
        row.offsetSlider.step = step.toString ();
        row.offsetSlider.value = planeSettings.offset.toString ();
        row.offsetInput.min = range.min.toString ();
        row.offsetInput.max = range.max.toString ();
        row.offsetInput.step = step.toString ();
        row.offsetInput.value = this.FormatOffset (planeSettings.offset);
    }

    GetAxisRange (axis)
    {
        if (this.boundingBox === null) {
            return {
                min : -1.0,
                max : 1.0
            };
        }
        if (axis === SectionPlaneAxis.X) {
            return {
                min : this.boundingBox.min.x,
                max : this.boundingBox.max.x
            };
        } else if (axis === SectionPlaneAxis.Y) {
            return {
                min : this.boundingBox.min.y,
                max : this.boundingBox.max.y
            };
        }
        return {
            min : this.boundingBox.min.z,
            max : this.boundingBox.max.z
        };
    }

    FormatOffset (offset)
    {
        return offset.toFixed (3);
    }

    OnChanged ()
    {
        this.callbacks.onPreview (this.settings.Clone ());
    }
}
