import { useState } from "react";
import { FLOOR_PLATE_ASSETS, FLOOR_PLATE_VIEWBOX, floorById, type FloorId } from "../../config/floors";
import { sampleUnitForType, unitTypeById, unitsByFloor, type Unit } from "../../config/units";
import { FloorPlateViewer } from "./FloorPlateViewer";
import { FloorSelector } from "./FloorSelector";
import { ResidenceBrowser } from "./ResidenceBrowser";
import { UnitDetailPanel } from "./UnitDetailPanel";
import { UnitPlanViewer } from "./UnitPlanViewer";

type BrowseMode = "floor" | "residence";

interface ExplorerRootProps {
  onExit: () => void;
}

/**
 * Top-level orchestrator for the Residence Explorer. Purely
 * click/tap-driven local state — deliberately not wired into the
 * cinematic experience's scroll progress, since this is a different UX
 * mode entered once (see HeroReveal.tsx's "EXPLORE NATIVE HAUS" CTA).
 */
export function ExplorerRoot({ onExit }: ExplorerRootProps) {
  const [browseMode, setBrowseMode] = useState<BrowseMode>("floor");
  const [selectedFloorId, setSelectedFloorId] = useState<FloorId | null>(null);
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<Unit | null>(null);

  const selectedFloor = selectedFloorId ? floorById(selectedFloorId) : null;
  const floorUnits = selectedFloorId ? unitsByFloor(selectedFloorId) : [];
  const plateAsset = selectedFloor?.floorPlateId ? FLOOR_PLATE_ASSETS[selectedFloor.floorPlateId] : undefined;
  const selectedType = selectedTypeId ? unitTypeById(selectedTypeId) : null;
  const sampleUnitForSelectedType = selectedTypeId ? sampleUnitForType(selectedTypeId) : undefined;

  function switchBrowseMode(mode: BrowseMode) {
    setBrowseMode(mode);
    setSelectedFloorId(null);
    setSelectedTypeId(null);
  }

  return (
    <div className="explorer">
      <header className="explorer__header">
        <button type="button" className="explorer__back-to-cinematic" onClick={onExit}>
          ← NATIVE HAUS
        </button>
        <div className="explorer__title">
          <span className="explorer__eyebrow">
            <span className="explorer__accent" aria-hidden="true" />
            RESIDENCE EXPLORER
          </span>
          <span className="explorer__heading">EXPLORE THE RESIDENCES</span>
        </div>
        <nav className="explorer__tabs" aria-label="Browse mode">
          <button
            type="button"
            className={browseMode === "floor" ? "explorer__tab explorer__tab--active" : "explorer__tab"}
            onClick={() => switchBrowseMode("floor")}
          >
            BROWSE BY FLOOR
          </button>
          <button
            type="button"
            className={browseMode === "residence" ? "explorer__tab explorer__tab--active" : "explorer__tab"}
            onClick={() => switchBrowseMode("residence")}
          >
            BROWSE BY RESIDENCE
          </button>
        </nav>
      </header>

      <main className="explorer__main">
        {browseMode === "floor" && !selectedFloor && <FloorSelector onSelect={setSelectedFloorId} />}

        {browseMode === "floor" && selectedFloor && (
          <div className="explorer__screen">
            <button type="button" className="explorer__breadcrumb" onClick={() => setSelectedFloorId(null)}>
              ← ALL LEVELS
            </button>
            <h2 className="explorer__screen-heading">FLOOR {selectedFloor.label}</h2>
            {plateAsset ? (
              <FloorPlateViewer
                floorLabel={selectedFloor.label}
                units={floorUnits}
                backgroundSrc={plateAsset}
                viewBox={FLOOR_PLATE_VIEWBOX}
                onSelectUnit={setSelectedUnit}
              />
            ) : (
              <p className="explorer__pending">This floor's plan is being finalized and will appear here shortly.</p>
            )}
          </div>
        )}

        {browseMode === "residence" && !selectedType && <ResidenceBrowser onSelectType={setSelectedTypeId} />}

        {browseMode === "residence" && selectedType && (
          <div className="explorer__screen">
            <button type="button" className="explorer__breadcrumb" onClick={() => setSelectedTypeId(null)}>
              ← ALL RESIDENCES
            </button>
            <h2 className="explorer__screen-heading">{selectedType.label}</h2>
            <p className="explorer__type-meta">
              {selectedType.areaSqFt} SQ FT · {selectedType.unitCount} {selectedType.unitCount === 1 ? "UNIT" : "UNITS"}
            </p>
            <div className="explorer__type-plan">
              <UnitPlanViewer src={selectedType.floorPlanAsset} alt={`${selectedType.label} representative plan`} />
            </div>
            {sampleUnitForSelectedType && (
              <button type="button" className="explorer__view-sample" onClick={() => setSelectedUnit(sampleUnitForSelectedType)}>
                VIEW SAMPLE UNIT ON FLOOR {floorById(sampleUnitForSelectedType.floor).label} →
              </button>
            )}
          </div>
        )}
      </main>

      {selectedUnit && <UnitDetailPanel unit={selectedUnit} onClose={() => setSelectedUnit(null)} />}
    </div>
  );
}
