import { format, getDaysInMonth, isAfter, isBefore, startOfDay } from 'date-fns';

export type CalendarPlanTier = 'basic' | 'pro' | 'business';
export type CalendarEventKind = 'festival' | 'custom';
export type CalendarEventType = 'Anniversary' | 'Sale' | 'Custom';
export type CalendarEventStatus = 'Scheduled' | 'Posted' | 'Disabled';
export type CalendarPostStatus = 'draft' | 'scheduled' | 'posted' | 'failed' | 'disabled';

export interface BrandingSettings {
  businessName: string;
  logoUrl: string;
  brandColorPrimary: string;
  brandColorSecondary: string;
  phoneNumber: string;
  address: string;
  socialHandle: string;
  tagline: string;
  industry: string;
  calendarPostingPaused: boolean;
}

export interface FestivalDefinition {
  key: string;
  name: string;
  month: number;
  day: number;
  featured: boolean;
  category: string;
  tone: string;
  industryHint?: string;
}

export interface CalendarMonthEvent {
  id: string;
  sourceKind: CalendarEventKind;
  sourceKey: string;
  name: string;
  eventDate: string;
  eventType: CalendarEventType | string;
  repeatYearly: boolean;
  isEnabled: boolean;
  status: CalendarEventStatus;
  labelColor: 'green' | 'blue';
  festivalKey?: string | null;
  logoUrl?: string | null;
  notes?: string | null;
  post?: CalendarPostSummary | null;
}

export interface CalendarPostSummary {
  id: string;
  status: CalendarPostStatus;
  scheduledFor: string | null;
  postedAt: string | null;
  instagramPostId: string | null;
  engagementStatus: string;
  failureReason: string | null;
  creativePreviewUrl: string | null;
  caption: string;
  postTitle: string;
}

export interface CalendarPostRecord extends CalendarPostSummary {
  workspaceId: string;
  sourceKind: CalendarEventKind;
  eventName: string;
  eventDate: string;
  festivalKey: string | null;
  retryCount: number;
  disabledReason: string | null;
  creativeSvg: string;
  calendarEventId: string | null;
  createdAt: string;
  updatedAt: string;
}

const INDUSTRY_THEME: Record<string, { primary: string; secondary: string; accent: string }> = {
  textile: { primary: '#14532d', secondary: '#86efac', accent: '#fef3c7' },
  jewellery: { primary: '#854d0e', secondary: '#fde68a', accent: '#faf5e4' },
  jewelry: { primary: '#854d0e', secondary: '#fde68a', accent: '#faf5e4' },
  beauty: { primary: '#9f1239', secondary: '#f9a8d4', accent: '#fff1f2' },
  fashion: { primary: '#1d4ed8', secondary: '#93c5fd', accent: '#eff6ff' },
  food: { primary: '#c2410c', secondary: '#fdba74', accent: '#fff7ed' },
  electronics: { primary: '#0f172a', secondary: '#60a5fa', accent: '#e0f2fe' },
  default: { primary: '#1f2937', secondary: '#a7f3d0', accent: '#ecfeff' },
};

export const CALENDAR_FESTIVALS: FestivalDefinition[] = [
  { key: 'new-year', name: 'New Year', month: 1, day: 1, featured: true, category: 'Global', tone: 'fresh start' },
  { key: 'mothers-day', name: "Mother's Day", month: 5, day: 12, featured: true, category: 'Lifestyle', tone: 'warm appreciation' },
  { key: 'independence-day', name: 'Independence Day', month: 8, day: 15, featured: true, category: 'National', tone: 'pride and celebration' },
  { key: 'diwali', name: 'Diwali', month: 10, day: 20, featured: true, category: 'Festival', tone: 'bright festive energy', industryHint: 'jewellery' },
  { key: 'dussehra', name: 'Dussehra', month: 10, day: 12, featured: false, category: 'Festival', tone: 'victory and prosperity' },
  { key: 'christmas', name: 'Christmas', month: 12, day: 25, featured: true, category: 'Festival', tone: 'joyful holiday spirit' },
  { key: 'eid', name: 'Eid', month: 4, day: 11, featured: true, category: 'Festival', tone: 'blessed celebration' },
  { key: 'holi', name: 'Holi', month: 3, day: 25, featured: true, category: 'Festival', tone: 'colorful joy' },
  { key: 'raksha-bandhan', name: 'Raksha Bandhan', month: 8, day: 19, featured: false, category: 'Festival', tone: 'bond and care' },
  { key: 'ganesh-chaturthi', name: 'Ganesh Chaturthi', month: 9, day: 7, featured: false, category: 'Festival', tone: 'auspicious beginnings' },
  { key: 'navratri', name: 'Navratri', month: 10, day: 3, featured: false, category: 'Festival', tone: 'spirited celebration' },
  { key: 'onam', name: 'Onam', month: 9, day: 15, featured: false, category: 'Festival', tone: 'floral tradition' },
];

export const PLAN_LIMITS: Record<CalendarPlanTier, { customEvents: number; festivalMode: 'limited' | 'all'; advancedBranding: boolean }> = {
  basic: { customEvents: 5, festivalMode: 'limited', advancedBranding: false },
  pro: { customEvents: 10, festivalMode: 'all', advancedBranding: false },
  business: { customEvents: Number.POSITIVE_INFINITY, festivalMode: 'all', advancedBranding: true },
};

export function normalizePlanTier(value: any): CalendarPlanTier {
  const tier = String(value || '').trim().toLowerCase();
  if (tier === 'business') return 'business';
  if (tier === 'pro') return 'pro';
  if (tier === 'basic') return 'basic';
  return 'basic';
}

export function getPlanLimits(value: any) {
  return PLAN_LIMITS[normalizePlanTier(value)];
}

export function getIndustryTheme(industry: string | null | undefined) {
  const key = String(industry || '').trim().toLowerCase();
  return INDUSTRY_THEME[key] || INDUSTRY_THEME.default;
}

export function escapeXml(value: string) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function parseWorkspaceSettings(settings: any): Record<string, any> {
  if (!settings) return {};
  if (typeof settings === 'string') {
    try {
      return JSON.parse(settings);
    } catch {
      return {};
    }
  }
  return settings;
}

export function getBrandingSettings(workspace: { name?: string; settings?: any } | null | undefined): BrandingSettings {
  const settings = parseWorkspaceSettings(workspace?.settings || {});
  const theme = getIndustryTheme(settings?.industry);
  return {
    businessName: String(settings?.businessName || workspace?.name || 'Your Business').trim(),
    logoUrl: String(settings?.logoUrl || settings?.brandingLogoUrl || '').trim(),
    brandColorPrimary: String(settings?.brandColorPrimary || theme.primary).trim(),
    brandColorSecondary: String(settings?.brandColorSecondary || theme.secondary).trim(),
    phoneNumber: String(settings?.phoneNumber || settings?.whatsappPhoneNumber || '').trim(),
    address: String(settings?.address || '').trim(),
    socialHandle: String(settings?.socialHandle || settings?.instagramHandle || '').trim(),
    tagline: String(settings?.tagline || '').trim(),
    industry: String(settings?.industry || 'default').trim(),
    calendarPostingPaused: !!settings?.calendarPostingPaused,
  };
}

export function getFestivalAvailability(tier: CalendarPlanTier, festival: FestivalDefinition) {
  if (tier === 'business') return true;
  if (tier === 'pro') return true;
  return festival.featured;
}

export function getAllowedFestivalCount(tier: CalendarPlanTier) {
  return tier === 'basic' ? CALENDAR_FESTIVALS.filter((festival) => festival.featured).length : CALENDAR_FESTIVALS.length;
}

export function getMonthlyFestivalOccurrences(year: number, month: number, tier: CalendarPlanTier) {
  return CALENDAR_FESTIVALS.filter((festival) => festival.month === month && getFestivalAvailability(tier, festival)).map((festival) => ({
    id: `festival:${festival.key}:${year}-${String(month).padStart(2, '0')}-${String(festival.day).padStart(2, '0')}`,
    festivalKey: festival.key,
    sourceKind: 'festival' as const,
    sourceKey: festival.key,
    name: festival.name,
    eventDate: `${year}-${String(month).padStart(2, '0')}-${String(festival.day).padStart(2, '0')}`,
    eventType: festival.category,
    repeatYearly: true,
    isEnabled: true,
    labelColor: 'green' as const,
    status: 'Scheduled' as const,
    notes: festival.tone,
  }));
}

export function deriveEventStatus(input: {
  isEnabled: boolean;
  eventDate: string;
  post?: { status?: string | null; postedAt?: string | null; scheduledFor?: string | null } | null;
  paused?: boolean;
}) {
  if (!input.isEnabled || input.paused) return 'Disabled' as const;
  if (String(input.post?.status || '').toLowerCase() === 'posted' || !!input.post?.postedAt) return 'Posted' as const;
  if (String(input.post?.status || '').toLowerCase() === 'failed') return 'Scheduled' as const;
  const eventDay = startOfDay(new Date(input.eventDate));
  const today = startOfDay(new Date());
  if (isBefore(eventDay, today)) {
    return input.post?.status === 'scheduled' ? 'Scheduled' as const : 'Posted' as const;
  }
  if (isAfter(eventDay, today) || eventDay.getTime() === today.getTime()) return 'Scheduled' as const;
  return 'Scheduled' as const;
}

export function calcAgeYears(eventDate: string) {
  const date = new Date(eventDate);
  const now = new Date();
  let years = now.getFullYear() - date.getFullYear();
  const anniversaryHasPassed =
    now.getMonth() > date.getMonth() ||
    (now.getMonth() === date.getMonth() && now.getDate() >= date.getDate());
  if (!anniversaryHasPassed) years -= 1;
  return Math.max(1, years);
}

export function calculateOptimalPublishTime(eventDate: string, eventType: string, tier: CalendarPlanTier) {
  const base = new Date(eventDate);
  const schedule = new Date(base);
  const type = String(eventType || '').trim().toLowerCase();
  const hoursByType: Record<string, number> = {
    anniversary: 10,
    sale: 11,
    custom: 10,
    festival: 9,
  };
  const hour = hoursByType[type] ?? 10;
  schedule.setHours(hour, tier === 'business' ? 15 : 0, 0, 0);
  return schedule.toISOString();
}

export function buildEventTitle(input: {
  name: string;
  eventType: string;
  eventDate: string;
  businessName: string;
  repeatYearly?: boolean;
}) {
  const type = String(input.eventType || '').toLowerCase();
  if (type === 'anniversary') {
    const years = calcAgeYears(input.eventDate);
    return `${years}${years === 1 ? 'st' : years === 2 ? 'nd' : years === 3 ? 'rd' : 'th'} Anniversary`;
  }
  if (type === 'sale') {
    return `${input.name} Sale`;
  }
  return input.name;
}

export function buildCaption(input: {
  title: string;
  businessName: string;
  eventType: string;
  phoneNumber?: string;
  address?: string;
  socialHandle?: string;
  tagline?: string;
}) {
  const parts = [
    input.title,
    `Celebrating with ${input.businessName}`,
    input.tagline ? `${input.tagline}` : '',
    input.eventType === 'Sale' ? 'Exclusive festive offers and limited-time deals.' : '',
    input.phoneNumber ? `Call: ${input.phoneNumber}` : '',
    input.address || input.socialHandle ? [input.address, input.socialHandle ? `IG: ${input.socialHandle}` : ''].filter(Boolean).join(' • ') : '',
  ].filter(Boolean);

  return parts.join('\n');
}

export function resolveScheduleTime(input: {
  eventDate: string;
  repeatYearly?: boolean;
  eventType: string;
  currentTier?: CalendarPlanTier;
}) {
  const sourceDate = new Date(input.eventDate);
  const now = new Date();
  let schedule = new Date(sourceDate);
  const type = String(input.eventType || '').trim().toLowerCase();
  const hoursByType: Record<string, number> = {
    anniversary: 10,
    sale: 11,
    custom: 10,
    festival: 9,
  };
  const hour = hoursByType[type] ?? 10;

  if (input.repeatYearly) {
    const eventThisYear = new Date(now.getFullYear(), sourceDate.getMonth(), sourceDate.getDate());
    const todayStart = startOfDay(now);
    const targetYear = isBefore(eventThisYear, todayStart)
      ? now.getFullYear() + 1
      : now.getFullYear();
    const daysInMonth = getDaysInMonth(new Date(targetYear, sourceDate.getMonth(), 1));
    const recurringDay = Math.min(sourceDate.getDate(), daysInMonth);
    schedule = new Date(targetYear, sourceDate.getMonth(), recurringDay);
  }

  if (isBefore(schedule, now)) {
    schedule.setTime(now.getTime() + 15 * 60 * 1000);
  }

  schedule.setHours(hour, input.currentTier === 'business' ? 15 : 0, 0, 0);
  if (isBefore(schedule, now)) {
    schedule.setTime(now.getTime() + 15 * 60 * 1000);
  }
  return schedule;
}

export function buildCalendarCreative(input: {
  eventName: string;
  eventDate: string;
  eventType: string;
  branding: BrandingSettings;
  festivalTone?: string;
  sourceKind: CalendarEventKind;
}) {
  const title = buildEventTitle({
    name: input.eventName,
    eventType: input.eventType,
    eventDate: input.eventDate,
    businessName: input.branding.businessName,
  });

  const caption = buildCaption({
    title,
    businessName: input.branding.businessName,
    eventType: input.eventType,
    phoneNumber: input.branding.phoneNumber,
    address: input.branding.address,
    socialHandle: input.branding.socialHandle,
    tagline: input.branding.tagline,
  });

  const creativeSvg = buildCreativeSvg({
    title,
    subtitle: input.sourceKind === 'festival' ? input.festivalTone : input.eventType,
    branding: input.branding,
    eventType: input.eventType,
    eventCategory: input.sourceKind === 'festival' ? 'System Festival' : 'Custom Event',
    festivalTone: input.festivalTone,
    footerLine: [input.branding.phoneNumber, input.branding.address || input.branding.socialHandle ? [input.branding.address, input.branding.socialHandle ? `@${input.branding.socialHandle.replace(/^@/, '')}` : ''].filter(Boolean).join(' • ') : '']
      .filter(Boolean)
      .join(' • '),
  });

  return { title, caption, creativeSvg };
}

export function buildCreativeSvg(input: {
  title: string;
  subtitle?: string;
  branding: BrandingSettings;
  eventType: string;
  eventCategory?: string;
  footerLine?: string;
  festivalTone?: string;
}) {
  const theme = getIndustryTheme(input.branding.industry);
  const backgroundPrimary = input.branding.brandColorPrimary || theme.primary;
  const backgroundSecondary = input.branding.brandColorSecondary || theme.secondary;
  const headline = escapeXml(input.title);
  const subtitle = escapeXml(input.subtitle || input.festivalTone || '');
  const businessName = escapeXml(input.branding.businessName);
  const footer = escapeXml(
    input.footerLine ||
    [input.branding.phoneNumber, input.branding.address || input.branding.socialHandle ? [input.branding.address, input.branding.socialHandle ? `@${input.branding.socialHandle.replace(/^@/, '')}` : ''].filter(Boolean).join(' • ') : '']
      .filter(Boolean)
      .join(' • ')
  );
  const tagline = escapeXml(input.branding.tagline || input.eventCategory || input.eventType);
  const logoUrl = String(input.branding.logoUrl || '').trim();
  const logoNode = logoUrl
    ? `<image href="${escapeXml(logoUrl)}" x="88" y="84" width="140" height="140" preserveAspectRatio="xMidYMid meet" clip-path="url(#logoClip)" />`
    : `<text x="158" y="166" text-anchor="middle" font-size="54" font-weight="700" fill="#ffffff">${escapeXml(
      businessName.slice(0, 1) || 'B'
    )}</text>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${backgroundPrimary}" />
      <stop offset="100%" stop-color="${backgroundSecondary}" />
    </linearGradient>
    <linearGradient id="panel" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255,255,255,0.94)" />
      <stop offset="100%" stop-color="rgba(255,255,255,0.78)" />
    </linearGradient>
    <clipPath id="logoClip">
      <rect x="74" y="70" width="168" height="168" rx="38" />
    </clipPath>
  </defs>
  <rect width="1080" height="1080" fill="url(#bg)" />
  <circle cx="910" cy="150" r="170" fill="rgba(255,255,255,0.16)" />
  <circle cx="180" cy="930" r="220" fill="rgba(255,255,255,0.11)" />
  <rect x="64" y="64" width="952" height="952" rx="54" fill="rgba(255,255,255,0.07)" stroke="rgba(255,255,255,0.18)" stroke-width="2" />
  <rect x="64" y="64" width="952" height="952" rx="54" fill="none" stroke="rgba(0,0,0,0.06)" stroke-width="1" />
  <rect x="96" y="96" width="888" height="888" rx="44" fill="rgba(255,255,255,0.16)" />
  <rect x="96" y="96" width="888" height="888" rx="44" fill="url(#panel)" />
  <rect x="96" y="96" width="888" height="888" rx="44" fill="none" stroke="rgba(255,255,255,0.45)" stroke-width="1.5" />

  <rect x="74" y="70" width="168" height="168" rx="38" fill="rgba(0,0,0,0.14)" />
  ${logoNode}

  <text x="288" y="145" font-size="30" font-weight="700" fill="rgba(0,0,0,0.58)" letter-spacing="3">${tagline}</text>
  <text x="288" y="205" font-size="60" font-weight="800" fill="#111827">${headline}</text>
  <text x="288" y="262" font-size="28" fill="rgba(17,24,39,0.72)">${businessName}</text>

  <rect x="88" y="318" width="904" height="454" rx="34" fill="rgba(255,255,255,0.58)" />
  <text x="128" y="410" font-size="38" font-weight="700" fill="#111827">${headline}</text>
  <text x="128" y="468" font-size="26" fill="rgba(17,24,39,0.7)">${subtitle}</text>
  <text x="128" y="560" font-size="24" font-weight="600" fill="rgba(17,24,39,0.64)">${escapeXml(
    input.eventCategory || input.eventType
  )}</text>

  <rect x="88" y="842" width="904" height="108" rx="26" fill="rgba(17,24,39,0.88)" />
  <text x="126" y="892" font-size="23" font-weight="600" fill="#ffffff">${footer || ' '}</text>
  <text x="126" y="930" font-size="20" fill="rgba(255,255,255,0.8)">${escapeXml(
    `${input.branding.phoneNumber || ''}${input.branding.phoneNumber && (input.branding.address || input.branding.socialHandle) ? ' • ' : ''}${input.branding.address || input.branding.socialHandle ? [input.branding.address, input.branding.socialHandle ? `@${input.branding.socialHandle.replace(/^@/, '')}` : ''].filter(Boolean).join(' • ') : ''}`
  )}</text>
  <text x="954" y="910" text-anchor="end" font-size="18" fill="rgba(255,255,255,0.68)">Branded Auto Post</text>
</svg>`;
}

export function buildCreativePreviewUrl(origin: string, postId: string) {
  return `${origin.replace(/\/$/, '')}/api/calendar/posts/${postId}/creative.svg`;
}

export function getDaysForMonth(year: number, month: number) {
  return getDaysInMonth(new Date(year, month - 1, 1));
}

export function isFestivalEnabledByPlan(tier: CalendarPlanTier, festivalKey: string) {
  const festival = CALENDAR_FESTIVALS.find((item) => item.key === festivalKey);
  if (!festival) return false;
  return getFestivalAvailability(tier, festival);
}

export function getAvailableFestivalKeys(tier: CalendarPlanTier) {
  return CALENDAR_FESTIVALS.filter((festival) => getFestivalAvailability(tier, festival)).map((festival) => festival.key);
}

export function monthDateKey(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function monthName(value: string | Date) {
  return format(new Date(value), 'MMMM yyyy');
}
