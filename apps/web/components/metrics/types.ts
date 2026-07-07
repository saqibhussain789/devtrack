export interface MetricsSnapshot {
  id: string;
  periodStart: string;
  periodEnd: string;
  velocityPoints: number;
  openPrCount: number;
  deployFrequency: string;
  leadTimeHours: string | null;
  changeFailureRate: string | null;
  mttrHours: string | null;
}

export interface WeeklyVelocityPoint {
  weekStart: string;
  points: number;
}

export interface ProjectMetrics {
  snapshot: MetricsSnapshot;
  weeklyVelocity: WeeklyVelocityPoint[];
}
