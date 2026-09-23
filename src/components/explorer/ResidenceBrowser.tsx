import { BEDROOM_CATEGORIES, unitTypesByCategory } from "../../config/units";

interface ResidenceBrowserProps {
  onSelectType: (typeId: string) => void;
}

/**
 * Browse-by-residence: large editorial cards grouped by bedroom
 * category, not small property-portal tiles. Every type in the official
 * schedule appears here (real areas/counts); only Studio Type A links
 * through to a working plan this round (see units.ts) — the rest are
 * still fully informative, just not yet interactive.
 */
export function ResidenceBrowser({ onSelectType }: ResidenceBrowserProps) {
  return (
    <div className="residence-browser">
      {BEDROOM_CATEGORIES.map((category) => {
        const types = unitTypesByCategory(category.id);
        if (types.length === 0) return null;
        return (
          <section key={category.id} className="residence-browser__category">
            <h3 className="residence-browser__category-title">{category.browseLabel}</h3>
            <div className="residence-browser__cards">
              {types.map((type) => (
                <button key={type.id} type="button" className="residence-card" onClick={() => onSelectType(type.id)}>
                  <span className="residence-card__label">{type.label}</span>
                  <span className="residence-card__area">{type.areaSqFt} SQ FT</span>
                  <span className="residence-card__count">
                    {type.unitCount} {type.unitCount === 1 ? "UNIT" : "UNITS"}
                  </span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
