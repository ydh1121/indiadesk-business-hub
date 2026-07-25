import type { Env } from './types';
import { getRange } from './google';

export type PermissionResourceType =
  | 'menu'
  | 'plan'
  | 'content'
  | 'architecture'
  | 'document'
  | 'system';

export type PermissionCatalogItem = {
  id: string;
  type: Exclude<PermissionResourceType, 'system'>;
  key: string;
  label: string;
  group: string;
  parentId?: string;
  description?: string;
};

export type PermissionRow = {
  row: number;
  username: string;
  resourceType: PermissionResourceType;
  resourceKey: string;
  allowed: boolean;
  updatedAt: string;
  updatedBy: string;
};

export type ArchitectureItem = {
  key: string;
  number: string;
  title: string;
  description: string;
  sortOrder: number;
};

export async function architectureItems(env: Env): Promise<ArchitectureItem[]> {
  const rows = await getRange(env, 'Architecture!A2:E1000');
  return rows
    .filter((row) => row[0])
    .map((row) => ({
      key: row[0],
      number: row[1] || '',
      title: row[2] || row[0],
      description: row[3] || '',
      sortOrder: Number(row[4] || 0),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

const FALLBACK_PLAN_LABELS: Record<string, string> = {
  v1: 'Version 1 · 기본사업',
  v2: 'Version 2 · 통합사업',
  v3: 'Version 3 · 실행 오더 데스크',
};

const boolValue = (value: unknown) => {
  const normalized = String(value ?? '').trim().toUpperCase();
  return normalized === 'TRUE' || normalized === '1' || normalized === 'YES' || normalized === 'Y';
};

export const permissionId = (type: PermissionResourceType, key: string) => `${type}:${key}`;

export async function permissionRows(env: Env): Promise<PermissionRow[]> {
  const rows = await getRange(env, 'Permissions!A2:F20000');
  return rows
    .filter((row) => row[0] && row[1] && row[2])
    .map((row, index) => ({
      row: index + 2,
      username: row[0],
      resourceType: row[1] as PermissionResourceType,
      resourceKey: row[2],
      allowed: boolValue(row[3]),
      updatedAt: row[4] || '',
      updatedBy: row[5] || '',
    }));
}

export async function userPermissionState(
  env: Env,
  username: string,
  role: 'admin' | 'guest',
) {
  if (role === 'admin') {
    return {
      initialized: true,
      admin: true,
      rules: new Map<string, boolean>(),
      can: (_type: PermissionResourceType, _key: string) => true,
    };
  }

  const rules = new Map<string, boolean>();
  const rows = await permissionRows(env);

  // 동일 자원에 중복 행이 있으면 아래쪽의 최신 행을 적용한다.
  for (const row of rows) {
    if (row.username !== username) continue;
    rules.set(permissionId(row.resourceType, row.resourceKey), row.allowed);
  }

  const initialized = rules.get(permissionId('system', 'initialized')) === true;

  return {
    initialized,
    admin: false,
    rules,
    // 권한을 한 번도 저장하지 않은 기존 계정은 배포 직후 잠기지 않도록 기존 전체 공개 상태를 유지한다.
    // 관리자가 공개 범위를 저장한 시점부터 명시적으로 허용된 자원만 공개한다.
    can: (type: PermissionResourceType, key: string) =>
      !initialized || rules.get(permissionId(type, key)) === true,
  };
}

function parsePlanLabels(rows: string[][]) {
  const labels = { ...FALLBACK_PLAN_LABELS };
  const raw = rows.find((row) => row[0] === 'business_plan_tabs')?.[1];
  if (!raw) return labels;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        const pageKey = String(item?.page_key || item?.pageKey || '').trim();
        const label = String(item?.label || '').trim();
        if (pageKey && label) labels[pageKey] = label;
      }
    }
  } catch {
    // 설정값이 깨져 있어도 기본 표시명으로 권한 편집을 계속할 수 있게 한다.
  }

  return labels;
}

export async function permissionCatalog(env: Env): Promise<PermissionCatalogItem[]> {
  const [contentRows, documentRows, settingRows, architecture] = await Promise.all([
    getRange(env, 'Content!A2:H3000'),
    getRange(env, 'Documents!A2:K2000'),
    getRange(env, 'Settings!A2:E1000'),
    architectureItems(env),
  ]);

  const labels = parsePlanLabels(settingRows);
  const content = contentRows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      pageKey: row[0],
      sectionKey: row[1],
      sortOrder: Number(row[2] || 0),
      title: row[3] || row[1],
    }));

  const pageOrder: string[] = [];
  for (const item of content) {
    if (!pageOrder.includes(item.pageKey)) pageOrder.push(item.pageKey);
  }

  const catalog: PermissionCatalogItem[] = [
    {
      id: permissionId('menu', 'plans'),
      type: 'menu',
      key: 'plans',
      label: '사업계획서',
      group: '상위 메뉴',
      description: '사업계획서 메뉴와 허용된 버전·섹션을 표시합니다.',
    },
    {
      id: permissionId('menu', 'architecture'),
      type: 'menu',
      key: 'architecture',
      label: '통합 아키텍처',
      group: '상위 메뉴',
      description: '통합 아키텍처 메뉴와 허용된 단계를 표시합니다.',
    },
    {
      id: permissionId('menu', 'documents'),
      type: 'menu',
      key: 'documents',
      label: '문서 다운로드',
      group: '상위 메뉴',
      description: '문서 목록과 허용된 다운로드 항목을 표시합니다.',
    },
  ];

  for (const pageKey of pageOrder) {
    catalog.push({
      id: permissionId('plan', pageKey),
      type: 'plan',
      key: pageKey,
      label: labels[pageKey] || pageKey.toUpperCase(),
      group: '사업계획서 버전',
      parentId: permissionId('menu', 'plans'),
    });
  }

  for (const item of content.sort((a, b) => {
    const pageDiff = pageOrder.indexOf(a.pageKey) - pageOrder.indexOf(b.pageKey);
    return pageDiff || a.sortOrder - b.sortOrder;
  })) {
    catalog.push({
      id: permissionId('content', `${item.pageKey}/${item.sectionKey}`),
      type: 'content',
      key: `${item.pageKey}/${item.sectionKey}`,
      label: `${labels[item.pageKey] || item.pageKey.toUpperCase()} · ${item.title}`,
      group: '사업계획서 세부 내용',
      parentId: permissionId('plan', item.pageKey),
      description: `${item.pageKey.toUpperCase()} · ${String(item.sortOrder).padStart(2, '0')}`,
    });
  }

  for (const item of architecture) {
    catalog.push({
      id: permissionId('architecture', item.key),
      type: 'architecture',
      key: item.key,
      label: `${item.number} · ${item.title}`,
      group: '통합 아키텍처 단계',
      parentId: permissionId('menu', 'architecture'),
      description: item.description,
    });
  }

  for (const row of documentRows.filter((item) => item[0])) {
    catalog.push({
      id: permissionId('document', row[0]),
      type: 'document',
      key: row[0],
      label: row[1] || row[0],
      group: '문서 다운로드 항목',
      parentId: permissionId('menu', 'documents'),
      description: [row[2], row[7]].filter(Boolean).join(' · '),
    });
  }

  return catalog;
}
