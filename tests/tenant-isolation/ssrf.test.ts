import { describe, expect, it } from 'vitest';
import { assertSafeOutboundUrl, isPrivateAddress } from '../../src/shared/webhooks/ssrf';

describe('SSRF protection', () => {
  it('classifies private and special-use addresses', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.1.2.3')).toBe(true);
    expect(isPrivateAddress('172.16.5.4')).toBe(true);
    expect(isPrivateAddress('192.168.0.5')).toBe(true);
    expect(isPrivateAddress('169.254.169.254')).toBe(true);
    expect(isPrivateAddress('100.64.0.1')).toBe(true);
    expect(isPrivateAddress('0.0.0.0')).toBe(true);
    expect(isPrivateAddress('::1')).toBe(true);
    expect(isPrivateAddress('fe80::1')).toBe(true);
    expect(isPrivateAddress('fd00::abcd')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('1.1.1.1')).toBe(false);
  });

  it('blocks loopback, link-local and RFC1918 destinations', async () => {
    await expect(assertSafeOutboundUrl('https://127.0.0.1/hook')).rejects.toThrow(/private|blocked/i);
    await expect(assertSafeOutboundUrl('https://10.1.2.3/hook')).rejects.toThrow(/private|blocked/i);
    await expect(assertSafeOutboundUrl('https://192.168.1.10/hook')).rejects.toThrow(/private|blocked/i);
    await expect(assertSafeOutboundUrl('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/private|blocked/i);
    await expect(assertSafeOutboundUrl('https://[::1]/hook')).rejects.toThrow(/private|blocked/i);
  });

  it('blocks the localhost hostname', async () => {
    await expect(assertSafeOutboundUrl('https://localhost/hook')).rejects.toThrow(/not allowed/i);
  });

  it('requires HTTPS by default', async () => {
    await expect(assertSafeOutboundUrl('http://8.8.8.8/hook')).rejects.toThrow(/HTTPS/i);
  });

  it('allows public HTTPS destinations', async () => {
    const result = await assertSafeOutboundUrl('https://8.8.8.8/hook');
    expect(result.url.hostname).toBe('8.8.8.8');
    expect(result.resolvedAddresses).toContain('8.8.8.8');
  });

  it('rejects URLs containing embedded credentials', async () => {
    await expect(assertSafeOutboundUrl('https://user:pass@8.8.8.8/hook')).rejects.toThrow(/credentials/i);
  });

  it('rejects malformed URLs', async () => {
    await expect(assertSafeOutboundUrl('not-a-url')).rejects.toThrow(/valid absolute URL/i);
  });
});
