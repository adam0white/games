import type { ChapterProjection, WorkspacePanel } from './workspaceFlow';

export function WorkspaceNavigation({
  chapter,
  selected,
  onSelect,
  counts,
  visiblePanels,
}: {
  chapter: ChapterProjection;
  selected: WorkspacePanel;
  onSelect: (panel: WorkspacePanel) => void;
  counts: Record<WorkspacePanel, number>;
  visiblePanels?: WorkspacePanel[];
}) {
  const panels: { id: WorkspacePanel; label: string; hint: string }[] = [
    {
      id: 'bench',
      label: chapter.tutorial ? 'At home' : 'Workbench',
      hint: 'One object at a time',
    },
    {
      id: 'work',
      label: chapter.tutorial ? 'Kept things' : 'Work & promises',
      hint: chapter.tutorial ? 'Projects for another day' : 'What you have agreed',
    },
    { id: 'people', label: 'People', hint: 'Ask, learn, work together' },
  ];
  const visible = panels.filter((panel) => !visiblePanels || visiblePanels.includes(panel.id));
  if (visible.length < 2) return null;
  return (
    <nav className="workspace-navigation" aria-label="Your workspace">
      {visible.map((panel) => (
        <button
          key={panel.id}
          type="button"
          aria-current={selected === panel.id ? 'page' : undefined}
          aria-controls={`workspace-${panel.id}`}
          onClick={() => onSelect(panel.id)}
        >
          <span>
            {panel.label}
            {counts[panel.id] > 0 && (
              <span className="navigation-count" title={`${counts[panel.id]} available choices`}>
                {counts[panel.id]}
              </span>
            )}
          </span>
          <small>{panel.hint}</small>
        </button>
      ))}
    </nav>
  );
}
