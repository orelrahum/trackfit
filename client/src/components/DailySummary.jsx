export default function DailySummary({ summary }) {
  if (!summary) return null;

  const { total_calories, total_protein, total_carbs, total_fat, meal_count, item_count, targets } = summary;

  const calTarget = targets?.daily_calories_target || 2000;
  const calPct = Math.min((total_calories / calTarget) * 100, 100);

  const macroData = [
    { label: 'חלבון', value: total_protein, target: targets?.daily_protein_target || 120, color: '#4CAF50', unit: 'g' },
    { label: 'פחמימות', value: total_carbs, target: targets?.daily_carbs_target || 250, color: '#FF9800', unit: 'g' },
    { label: 'שומן', value: total_fat, target: targets?.daily_fat_target || 65, color: '#F44336', unit: 'g' },
  ];

  return (
    <div className="daily-summary">
      <div className="summary-calories">
        <div className="cal-number">{Math.round(total_calories)}</div>
        <div className="cal-target">/ {Math.round(calTarget)} קק״ל</div>
        <div className="cal-bar-bg">
          <div className="cal-bar-fill" style={{ width: `${calPct}%` }} />
        </div>
        <div className="cal-meta">{meal_count} ארוחות · {item_count} פריטים</div>
      </div>

      <div className="summary-macros">
        {macroData.map((macro) => {
          const pct = macro.target > 0 ? Math.min((macro.value / macro.target) * 100, 100) : 0;
          return (
            <div key={macro.label} className="macro-item">
              <div className="macro-bar-bg">
                <div 
                  className="macro-bar-fill" 
                  style={{ width: `${pct}%`, backgroundColor: macro.color }}
                />
              </div>
              <div className="macro-info">
                <span className="macro-label" style={{ color: macro.color }}>{macro.label}</span>
                <span className="macro-value">{macro.value.toFixed(1)} / {macro.target}{macro.unit}</span>
                <span className="macro-pct">{Math.round(pct)}%</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
