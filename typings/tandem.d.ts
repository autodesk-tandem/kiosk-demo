declare namespace Autodesk {
  namespace Tandem {
    // events
    const DT_CURRENT_VIEW_CHANGED_EVENT: string;
    const DT_FACETS_LOADED: string;
    const DT_STREAM_MARKER_MOUSE_OVER: string;
    const DT_STREAM_MARKER_MOUSE_OUT: string;
    const DT_STREAM_MARKER_CHANGED_EVENT: string;

    // constants
    namespace DtConstants {
      namespace HUD_LAYER {
        const LEVELS: {
          id: string;
          priority: number;
         };
      }
    }

    interface CompactView {
      id: string;
      dashboardName: string;
      default: boolean;
      facets?: any;
      label: string;
      viewName: string;
    }

    interface View extends CompactView {
      camera?: any;
      createTime?: string;
      dashboard?: any;
    }

    class DtApp {
      constructor(options?: any);

      currentFacility: DtFacility;
      views: DtViews;

      addEventListener(event: string, callback: (event: any) => void): void;

      displayFacility(facility: DtFacility, initialViewInfo: Set<string> | View | undefined, viewer: Autodesk.Viewing.Viewer3D, forceReload?: boolean): Promise<void>;
      getCurrentTeamsFacilities(): Promise<DtFacility[]>;
      getFacility(urn: string): Promise<DtFacility>;
      getSharedFacilities(forceReload?: boolean): Promise<DtFacility[]>;
      getTeams(): Promise<DtTeam[]>;
    }

    class DtFacility {
      app: DtApp;
      facetsManager: FacetsManager;
      hud: any;
      models: { [key: string]: DtModel; };
      modelsList: DtModel[];
      settings: {
        dateCreated: string;
        dateModified: string;
        links: any[];
        props: { [key: string]: { [key: string]: string; }};
        template: any;
      };
      streamMgr: any;
      twinId: string;
      viewer: Autodesk.Viewing.GuiViewer3D;

      getDefaultModel(): DtModel;
      getModels(skipDefault?: boolean): DtModel[];
      getSavedViewsList(): Promise<CompactView[]>;
      getVisibleElementsByURN(skipDefault?: boolean): { [key: string]: number[]; };
      unloadModels(): void;
      urn(): string;
      waitForAllModels(): Promise<void>;
    }

    class DtModel {
      id: number;

      getDbIdsFromElementIds(elementIds: string[]): Promise<number[]>;
      getData(): any;
      getElementIdsFromDbIds(dbIds: number[]): Promise<string[]>;
      getLevels(): Promise<{ [key: string]: any; }>;
      getPropertiesDt(dbIds: number[], options?: { classificationId?: string; history?: boolean; includeDeleted?: boolean; intersect?: boolean; wantTimeSeries?: boolean; }): Promise<any[]>;
      getRooms(): Promise<{ [key: string]: any; }>;
      getTaggedAssets(): Promise<{ cols: any[]; rows: any[]; }>;
      getVisibleDbIds(): number[];
      waitForLoad(waitForFragments: boolean, waitForInstanceTree: boolean): Promise<void>;
    }

    class DtTeam {
      id: string;
      name: string;
      owner: string;
      facilities: DtFacility[];

      getFacilities(): Promise<DtFacility[]>;
    }

    class DtViews {
      currentView: CompactView;

      addEventListener(event: string, callback: (event: any) => void): void;

      fetchFacilityViews(facility: DtFacility, forceFetch?: boolean): Promise<CompactView[]>;
      fetchSpecificView(facility: DtFacility, viewId: string, forceFetch?: boolean): Promise<View>;
      setCurrentView(facility: DtFacility, view: View): Promise<void>;
    }

    class FacetDef {
      id: string;
      filter: Set<any>;
      hidden: boolean;
      isIntersectionFilter: boolean;

      getSettings(): any;
      isLoaded(): boolean;
    }

    const FacetTypes: {
      assemblyCode: string;
      attributes: string;
      categories: string;
      classifications: string;
      families: string;
      levels: string;
      mepSystems: string;
      models: string;
      parameters: string;
      spaces: string;
      status: string;
      systemClasses: string;
      tandemCategories: string;
      types: string;
    };

    class FacetsManager {
      facetDefs: FacetDef[];
      facetsEffects: any;

      addFacetDef(settings: any, insertIndex: number): Promise<FacetDef[]>;
      applyTheme(facetId?: string, colorMap?: { [key: string]: any; }): void;
      getFacetDefs(): FacetDef[];
      generateColorMap(colorMaps: { [key: string]: any; }): { [key: string]: any;};
      setSettings(settings: any): Promise<void>;
      updateFacets(urn?: string, skipIsolationUpdate?: boolean, visile?: boolean): any[];
    }
  }
}