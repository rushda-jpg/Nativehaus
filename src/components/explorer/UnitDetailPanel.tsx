import { useEffect } from "react";
import { floorById } from "../../config/floors";
import { BEDROOM_CATEGORIES, unitTypeById, type Unit } from "../../config/units";
import { UnitPlanViewer } from "./UnitPlanViewer";

interface UnitDetailPanelProps {
  unit: Unit;
  onClose: () => void;
}

/**
 * Reusable unit-detail panel — everything it needs comes from the Unit +
 * UnitTypeDef records, so the same component serves both browse modes
 * (a unit clicked on a floor plate, or a unit reached via the residence
 * browser). Intentionally limited to the fields already approved: price,
 * availability, view, orientation and payment plan are NOT here yet —
 * they're only added once real data exists for them.
 */
export function UnitDetailPanel({ unit, onClose }: UnitDetailPanelProps) {
  const type = unitTypeById(unit.unitTypeId);
  const floor = floorById(unit.floor);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  if (!type) return null;

  const category = BEDROOM_CATEGORIES.find((c) => c.id === type.bedroomCategory);
  const planSrc = unit.floorPlanAsset ?? type.floorPlanAsset;

  return (
    <div className="unit-detail-panel" role="dialog" aria-modal="true" aria-label={`${type.label} details`}>
      <button type="button" className="unit-detail-panel__scrim" onClick={onClose} aria-label="Close panel" />
      <div className="unit-detail-panel__sheet">
        <button type="button" className="unit-detail-panel__close" onClick={onClose} aria-label="Close">
          ×
        </button>

        <div className="unit-detail-panel__meta">
          <span className="unit-detail-panel__eyebrow">FLOOR {floor.label}</span>
          <h2 className="unit-detail-panel__unit-number">{unit.unitNumber ?? "Unit number — pending official schedule"}</h2>

          <dl className="unit-detail-panel__facts">
            <div className="unit-detail-panel__fact">
              <dt>TYPE</dt>
              <dd>{type.label}</dd>
            </div>
            <div className="unit-detail-panel__fact">
              <dt>CATEGORY</dt>
              <dd>{category?.browseLabel ?? type.bedroomCategory}</dd>
            </div>
            <div className="unit-detail-panel__fact">
              <dt>AREA</dt>
              <dd>{type.areaSqFt} SQ FT</dd>
            </div>
            {unit.specialAttributes && unit.specialAttributes.length > 0 && (
              <div className="unit-detail-panel__fact">
                <dt>NOTES</dt>
                <dd>{unit.specialAttributes.join(", ")}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="unit-detail-panel__plan">
          <UnitPlanViewer src={planSrc} alt={`${type.label} unit plan`} />
        </div>
      </div>
    </div>
  );
}
