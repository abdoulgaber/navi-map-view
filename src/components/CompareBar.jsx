/** Bottom bar shown in compare mode: selection chips + actions */
export default function CompareBar({ visible, items, maxHit, onRemove, onClear, onView }) {
  if (!visible) return null

  return (
    <div className="compare-bar">
      <div className="compare-chips">
        {maxHit && <span className="compare-hint compare-hint--warn">Max 4 projects — remove one to add another</span>}
        {!maxHit && items.length === 0 && (
          <span className="compare-hint">Tap 2–4 projects on the map or list to compare</span>
        )}
        {!maxHit && items.map(p => (
          <span key={p.id} className="compare-chip">
            {p.name}
            <button type="button" onClick={() => onRemove(p.id)}>×</button>
          </span>
        ))}
      </div>
      <div className="compare-actions">
        <button type="button" className="compare-clear" onClick={onClear}>Clear</button>
        <button type="button" className="compare-view" disabled={items.length < 2} onClick={onView}>
          Compare ({items.length})
        </button>
      </div>
    </div>
  )
}
