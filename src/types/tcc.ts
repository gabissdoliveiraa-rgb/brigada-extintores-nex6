/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SpecificObjective {
  id: string;
  text: string;
  completed: boolean;
}

export interface MethodologyStep {
  title: string;
  desc: string;
  duration: string;
}

export interface MetricCard {
  label: string;
  value: string;
  unit?: string;
  detail: string;
}

export interface ChartPoint {
  label: string;
  baseline: number;
  proposed: number;
}

export interface ResearchFinding {
  title: string;
  description: string;
  impact: string;
}

export interface TimelineMilestone {
  phase: string;
  period: string;
  status: 'completed' | 'in_progress' | 'planned';
  description: string;
}

export interface CommitteeMember {
  name: string;
  title: string;
  institution: string;
  role: 'Presidente / Orientador(a)' | 'Avaliador(a) Interno(a)' | 'Avaliador(a) Externo(a)' | 'Coorientador(a)';
  avatarUrl?: string;
}

export interface DeliverableItem {
  id: string;
  title: string;
  type: 'pdf' | 'slides' | 'code' | 'dataset' | 'article';
  detail: string;
  fileSize: string;
  link?: string;
}

export interface ReferenceItem {
  id: string;
  author: string;
  year: number;
  title: string;
  source: string;
  abntFormatted: string;
}

export interface DefenseQuestion {
  id: string;
  question: string;
  answerHint: string;
  category: 'Metodologia' | 'Resultados' | 'Fundamentação' | 'Trabalhos Futuros';
}

export interface TccData {
  title: string;
  subtitle: string;
  studentName: string;
  studentEmail: string;
  studentPhoto: string;
  advisor: string;
  coAdvisor?: string;
  institution: string;
  course: string;
  department: string;
  year: number;
  defenseDate: string;
  defenseTime: string;
  defenseLocation: string;
  presentationLink?: string;
  area: string;
  grade?: string; // Optional final grade
  abstractPt: string;
  keywordsPt: string[];
  abstractEn: string;
  keywordsEn: string[];
  problem: string;
  hypothesis: string;
  generalObjective: string;
  specificObjectives: SpecificObjective[];
  methodology: {
    approach: string;
    nature: string;
    objectiveType: string;
    procedures: string;
    sampleDescription: string;
    steps: MethodologyStep[];
  };
  results: {
    metric1: MetricCard;
    metric2: MetricCard;
    metric3: MetricCard;
    findings: ResearchFinding[];
    chartData: ChartPoint[];
    chartMetricLabel: string;
  };
  timeline: TimelineMilestone[];
  committee: CommitteeMember[];
  deliverables: DeliverableItem[];
  references: ReferenceItem[];
  defenseQuestions: DefenseQuestion[];
}
