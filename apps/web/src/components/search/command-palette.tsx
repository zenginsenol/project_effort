'use client';

import { Command } from 'cmdk';
import { FileSearch, Loader2, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { SearchResultItem } from '@/components/search/search-result-item';
import { useKeyboardShortcut } from '@/hooks/use-keyboard-shortcut';
import { cn } from '@/lib/utils';

import type { EntityType, SearchResultItem as SearchResult } from '@/types/search';

interface CommandPaletteProps {
  className?: string;
}

// Mock data for now - will be replaced with actual search in next subtask
const MOCK_RECENT_SEARCHES: string[] = [];
const MOCK_SEARCH_RESULTS: SearchResult[] = [];

export function CommandPalette({ className }: CommandPaletteProps): React.ReactElement {
  const router = useRouter();
  const { isOpen, close } = useKeyboardShortcut({ key: 'k', ctrlKey: true, metaKey: true });
  const [search, setSearch] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<SearchResult[]>(MOCK_SEARCH_RESULTS);
  const [recentSearches, setRecentSearches] = useState<string[]>(MOCK_RECENT_SEARCHES);

  // Reset search when palette closes
  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setResults([]);
    }
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape' && isOpen) {
        close();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, close]);

  const handleSelect = (result: SearchResult): void => {
    // Navigate based on entity type
    let url = '';
    switch (result.entityType) {
      case 'projects':
        url = `/dashboard/projects/${result.id}`;
        break;
      case 'tasks':
        url = `/dashboard/projects/${result.projectId}`;
        break;
      case 'cost_analyses':
        url = `/dashboard/analyzer`;
        break;
      case 'sessions':
        url = `/dashboard/sessions/${result.id}`;
        break;
    }

    if (url) {
      router.push(url);
      close();
    }
  };

  const handleRecentSearchClick = (query: string): void => {
    setSearch(query);
  };

  // Group results by entity type
  const groupedResults = results.reduce<Record<EntityType, SearchResult[]>>(
    (acc, result) => {
      if (!acc[result.entityType]) {
        acc[result.entityType] = [];
      }
      acc[result.entityType].push(result);
      return acc;
    },
    {
      projects: [],
      tasks: [],
      cost_analyses: [],
      sessions: [],
    }
  );

  const hasResults = results.length > 0;
  const hasRecentSearches = recentSearches.length > 0;
  const showEmptyState = !isLoading && search.length > 0 && !hasResults;
  const showRecentSearches = !isLoading && search.length === 0 && hasRecentSearches;

  if (!isOpen) {
    return <></>;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={close}
        aria-hidden="true"
      />

      {/* Command Palette Dialog */}
      <div className={cn('fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2', className)}>
        <Command
          className="overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
          shouldFilter={false}
        >
          {/* Search Input */}
          <div className="flex items-center border-b border-border px-4">
            <Search className="mr-2 h-5 w-5 shrink-0 text-muted-foreground" />
            <Command.Input
              value={search}
              onValueChange={setSearch}
              placeholder="Search projects, tasks, cost analyses, sessions..."
              className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
            {isLoading && (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-muted-foreground" />
            )}
            {search.length > 0 && !isLoading && (
              <button
                onClick={() => setSearch('')}
                className="shrink-0 rounded-sm p-1 hover:bg-accent"
                aria-label="Clear search"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {/* Results */}
          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Empty State */}
            {showEmptyState && (
              <Command.Empty className="flex flex-col items-center justify-center py-12 text-center">
                <FileSearch className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm font-medium">No results found</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Try adjusting your search query
                </p>
              </Command.Empty>
            )}

            {/* Recent Searches */}
            {showRecentSearches && (
              <Command.Group heading="Recent Searches" className="px-2 py-2">
                {recentSearches.map((query, index) => (
                  <Command.Item
                    key={`recent-${index}`}
                    onSelect={() => handleRecentSearchClick(query)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent"
                  >
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <span>{query}</span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Grouped Results */}
            {hasResults && (
              <>
                {groupedResults.projects.length > 0 && (
                  <Command.Group heading="Projects" className="mb-3 px-2 py-2">
                    {groupedResults.projects.map((result) => (
                      <Command.Item
                        key={result.id}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        <SearchResultItem
                          result={result}
                          onSelect={handleSelect}
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {groupedResults.tasks.length > 0 && (
                  <Command.Group heading="Tasks" className="mb-3 px-2 py-2">
                    {groupedResults.tasks.map((result) => (
                      <Command.Item
                        key={result.id}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        <SearchResultItem
                          result={result}
                          onSelect={handleSelect}
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {groupedResults.cost_analyses.length > 0 && (
                  <Command.Group heading="Cost Analyses" className="mb-3 px-2 py-2">
                    {groupedResults.cost_analyses.map((result) => (
                      <Command.Item
                        key={result.id}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        <SearchResultItem
                          result={result}
                          onSelect={handleSelect}
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}

                {groupedResults.sessions.length > 0 && (
                  <Command.Group heading="Estimation Sessions" className="mb-3 px-2 py-2">
                    {groupedResults.sessions.map((result) => (
                      <Command.Item
                        key={result.id}
                        onSelect={() => handleSelect(result)}
                        className="cursor-pointer"
                      >
                        <SearchResultItem
                          result={result}
                          onSelect={handleSelect}
                        />
                      </Command.Item>
                    ))}
                  </Command.Group>
                )}
              </>
            )}

            {/* Initial State - when no search and no recent searches */}
            {!isLoading && search.length === 0 && !hasRecentSearches && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="mb-3 h-12 w-12 text-muted-foreground/50" />
                <p className="text-sm font-medium">Search across your workspace</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Find projects, tasks, analyses, and sessions
                </p>
              </div>
            )}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-border bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                  ↑↓
                </kbd>
                <span>Navigate</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                  ↵
                </kbd>
                <span>Select</span>
              </div>
              <div className="flex items-center gap-1">
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                  Esc
                </kbd>
                <span>Close</span>
              </div>
            </div>
            <div>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium">
                ⌘K
              </kbd>
            </div>
          </div>
        </Command>
      </div>
    </>
  );
}
