import type { Env, PagesFunction } from '../_shared/types';
import { readJson, ok, fail } from '../_shared/response';
import { findAccount, devices, saveDevice, addDevice, accessLog } from '../_shared/data';
import { verifyPassword, sha256, randomToken } from '../_shared/crypto';
import { requestMeta, nowIso } from '../_shared/request';
import { issueSession, sessionCookie, issueDeviceCookie, readDeviceCookie } from '../_shared/session';

type Body = {
  username: string;
  password: string;
  device: { category: 'pc'|'mobile'; os: string; browser: string; userAgent: string; screen?: string };
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const meta = requestMeta(request);
  let username = '';
  let serverDeviceId = '';
  try {
    const body = await readJson<Body>(request);
    username = (body.username || '').trim().toLowerCase();
    if (!body.device || !['pc', 'mobile'].includes(body.device.category)) return fail(400, '기기 정보가 올바르지 않습니다.');

    const cookieDeviceId = await readDeviceCookie(env, request);
    serverDeviceId = cookieDeviceId || randomToken(24);
    const log = async (success: boolean, reason: string) => accessLog(env, [
      nowIso(), username, 'LOGIN', success, reason, meta.ip, meta.country, meta.city, meta.colo,
      serverDeviceId, body.device.category, body.device.os || '', body.device.browser || '', meta.userAgent
    ]);

    const account = await findAccount(env, username);
    if (!account) {
      await log(false, 'ACCOUNT_NOT_FOUND');
      return fail(401, '계정 또는 비밀번호가 올바르지 않습니다.');
    }
    if (account.status !== 'active') {
      await log(false, `ACCOUNT_${account.status.toUpperCase()}`);
      return fail(403, account.status === 'pending' ? '비밀번호가 아직 설정되지 않았습니다.' : '사용이 중지된 계정입니다.');
    }
    if (!account.hash || !(await verifyPassword(body.password || '', account.salt, account.hash, account.iterations))) {
      await log(false, 'PASSWORD_MISMATCH');
      return fail(401, '계정 또는 비밀번호가 올바르지 않습니다.');
    }

    const allDevices = await devices(env);
    const fingerprint = await sha256(`${username}|${serverDeviceId}|${body.device.category}`);
    let current = allDevices.find((device) => device.username === username && device.fingerprintHash === fingerprint);
    const now = nowIso();

    if (account.role !== 'admin' && !current) {
      const active = allDevices.filter((device) => device.username === username && device.category === body.device.category && device.active);
      const limit = body.device.category === 'pc' ? account.pcLimit : account.mobileLimit;
      if (active.length >= limit) {
        if (account.devicePolicy === 'BLOCK') {
          await log(false, 'DEVICE_LIMIT_BLOCK');
          return fail(403, `${body.device.category === 'pc' ? 'PC' : '모바일'} 등록 한도를 초과했습니다. Admin 승인이 필요합니다.`);
        }
        if (account.devicePolicy === 'REPLACE') {
          for (const oldDevice of active) {
            oldDevice.active = false;
            oldDevice.lastSeen = now;
            await saveDevice(env, oldDevice);
          }
        }
      }
    }

    if (current) {
      if (!current.active && account.role !== 'admin') {
        await log(false, 'DEVICE_DISABLED');
        return fail(403, '해제된 기기입니다. Admin 승인이 필요합니다.');
      }
      current.lastIp = meta.ip;
      current.country = meta.country;
      current.city = meta.city;
      current.lastSeen = now;
      current.lastLogin = now;
      current.os = body.device.os;
      current.browser = body.device.browser;
      current.userAgent = body.device.userAgent || meta.userAgent;
      current.active = true;
      await saveDevice(env, current);
    } else {
      await addDevice(env, {
        deviceId: serverDeviceId,
        username,
        category: body.device.category,
        fingerprintHash: fingerprint,
        userAgent: body.device.userAgent || meta.userAgent,
        os: body.device.os,
        browser: body.device.browser,
        firstIp: meta.ip,
        lastIp: meta.ip,
        country: meta.country,
        city: meta.city,
        firstSeen: now,
        lastSeen: now,
        active: true,
        lastLogin: now
      });
    }

    const session = await issueSession(env, { username: account.username, role: account.role, displayName: account.displayName });
    await log(true, 'OK');
    const response = ok({ user: { username: account.username, role: account.role, displayName: account.displayName }, csrf: session.payload.csrf });
    response.headers.append('set-cookie', sessionCookie(session.token, session.ttl));
    if (!cookieDeviceId) response.headers.append('set-cookie', await issueDeviceCookie(env, serverDeviceId));
    return response;
  } catch (error) {
    try {
      await accessLog(env, [nowIso(), username, 'LOGIN', false, 'SERVER_ERROR', meta.ip, meta.country, meta.city, meta.colo, serverDeviceId, '', '', '', meta.userAgent]);
    } catch {}
    return fail(400, error instanceof Error ? error.message : '로그인 실패');
  }
};
