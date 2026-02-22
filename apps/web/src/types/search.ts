export type EntityType = 'projects' | 'tasks' | 'cost_analyses' | 'sessions';

export interface SearchResultItem {
  id: string;
  entityType: EntityType;
  title: string;
  description: string | null;
  projectId?: string;
  projectName?: string;
  status?: string;
  relevanceScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchOutput {
  results: SearchResultItem[];
  totalCount: number;
  groupedResults: {
    projects: SearchResultItem[];
    tasks: SearchResultItem[];
    cost_analyses: SearchResultItem[];
    sessions: SearchResultItem[];
  };
}

export interface SearchInput {
  query: string;
  entityTypes?: EntityType[];
  projectId?: string;
  status?: string;
  dateRange?: {
    start?: string;
    end?: string;
  };
}
