import { AddDiv, GetDomElementOuterWidth, SetDomElementOuterHeight, SetDomElementOuterWidth, ShowDomElement } from '../engine/viewer/domutils.js';
import { PanelSet } from './panelset.js';
import { SidebarDetailsPanel } from './sidebardetailspanel.js';
import { SidebarSettingsPanel } from './sidebarsettingspanel.js';

export class Sidebar
{
    constructor (mainDiv, settings)
    {
        this.mainDiv = mainDiv;
        this.panelSet = new PanelSet (mainDiv);

        this.detailsPanel = new SidebarDetailsPanel (this.panelSet.GetContentDiv ());
        this.settingsPanel = new SidebarSettingsPanel (this.panelSet.GetContentDiv (), settings);
        this.temporaryPanelDiv = null;
        this.temporaryPanelState = null;

        this.panelSet.AddPanel (this.detailsPanel);
        this.panelSet.AddPanel (this.settingsPanel);
        this.panelSet.ShowPanel (this.detailsPanel);
    }

    IsPanelsVisible ()
    {
        return this.panelSet.IsPanelsVisible ();
    }

    ShowPanels (show)
    {
        this.panelSet.ShowPanels (show);
    }

    Init (callbacks)
    {
        this.callbacks = callbacks;

        this.panelSet.Init ({
            onResizeRequested : () => {
                this.callbacks.onResizeRequested ();
            },
            onShowHidePanels : (show) => {
                this.callbacks.onShowHidePanels (show);
            }
        });

        this.settingsPanel.Init ({
            getShadingType : () => {
                return this.callbacks.getShadingType ();
            },
            getProjectionMode : () => {
                return this.callbacks.getProjectionMode ();
            },
            getDefaultMaterials : () => {
                return this.callbacks.getDefaultMaterials ();
            },
            onEnvironmentMapChanged : () => {
                this.callbacks.onEnvironmentMapChanged ();
            },
            onBackgroundColorChanged : () => {
                this.callbacks.onBackgroundColorChanged ();
            },
            onDefaultColorChanged : () => {
                this.callbacks.onDefaultColorChanged ();
            },
            onEdgeDisplayChanged : () => {
                this.callbacks.onEdgeDisplayChanged ();
            }
        });
    }

    UpdateControlsStatus ()
    {
        this.settingsPanel.UpdateControlsStatus ();
    }

    UpdateControlsVisibility ()
    {
        this.settingsPanel.UpdateControlsVisibility ();
    }

    Resize (height)
    {
        SetDomElementOuterHeight (this.mainDiv, height);
        this.panelSet.Resize ();
        if (this.temporaryPanelDiv !== null) {
            SetDomElementOuterHeight (this.temporaryPanelDiv, height);
        }
    }

    GetWidth ()
    {
        return GetDomElementOuterWidth (this.mainDiv);
    }

    SetWidth (width)
    {
        SetDomElementOuterWidth (this.mainDiv, width);
    }

    Clear ()
    {
        this.panelSet.Clear ();
    }

    ShowTemporaryPanel ()
    {
        if (this.temporaryPanelDiv !== null) {
            return this.temporaryPanelDiv;
        }

        this.temporaryPanelState = {
            panelsVisible : this.panelSet.IsPanelsVisible (),
            width : this.GetWidth ()
        };

        ShowDomElement (this.panelSet.menuDiv, false);
        ShowDomElement (this.panelSet.contentDiv, false);
        this.temporaryPanelDiv = AddDiv (this.mainDiv, 'ov_sidebar_temporary ov_thin_scrollbar');
        SetDomElementOuterWidth (this.mainDiv, Math.max (this.temporaryPanelState.width, 320));

        this.callbacks.onShowHidePanels (true);
        this.callbacks.onResizeRequested ();
        return this.temporaryPanelDiv;
    }

    CloseTemporaryPanel ()
    {
        if (this.temporaryPanelDiv === null) {
            return;
        }

        this.temporaryPanelDiv.remove ();
        this.temporaryPanelDiv = null;

        ShowDomElement (this.panelSet.menuDiv, true);
        ShowDomElement (this.panelSet.contentDiv, this.temporaryPanelState.panelsVisible);
        SetDomElementOuterWidth (this.mainDiv, this.temporaryPanelState.width);
        this.callbacks.onShowHidePanels (this.temporaryPanelState.panelsVisible);
        this.temporaryPanelState = null;
        this.callbacks.onResizeRequested ();
    }

    AddObject3DProperties (model, object3D)
    {
        this.detailsPanel.AddObject3DProperties (model, object3D);
    }

    AddMaterialProperties (material)
    {
        this.detailsPanel.AddMaterialProperties (material);
    }
}
