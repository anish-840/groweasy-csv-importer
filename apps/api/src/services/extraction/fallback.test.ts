import { describe, expect, it } from 'vitest';
import { buildHeaderMap, createFallbackProvider } from './fallback.js';

describe('buildHeaderMap', () => {
  it('maps common lead-export headers to CRM fields', () => {
    const { map } = buildHeaderMap([
      'Full Name',
      'Email Address',
      'Phone Number',
      'Company Name',
      'City',
      'Lead Status',
    ]);
    expect(map.get('Full Name')).toBe('name');
    expect(map.get('Email Address')).toBe('email');
    expect(map.get('Phone Number')).toBe('mobile_without_country_code');
    expect(map.get('Company Name')).toBe('company');
    expect(map.get('City')).toBe('city');
    expect(map.get('Lead Status')).toBe('crm_status');
  });

  it('disambiguates "company name" from "name" and "country code" from "country"', () => {
    const { map } = buildHeaderMap(['Name', 'Company Name', 'Country', 'Country Code']);
    expect(map.get('Name')).toBe('name');
    expect(map.get('Company Name')).toBe('company');
    expect(map.get('Country')).toBe('country');
    expect(map.get('Country Code')).toBe('country_code');
  });

  it('reports unmapped columns', () => {
    const { unmapped } = buildHeaderMap(['Email', 'Favourite Colour']);
    expect(unmapped).toContain('Favourite Colour');
  });
});

describe('fallback provider', () => {
  it('recovers email/phone from an ambiguous column and ignores the lead-owner email', async () => {
    const provider = createFallbackProvider();
    const headers = ['Lead Owner', 'Name', 'Contact Details', 'Extra'];
    const records = await provider.extractBatch(
      {
        startIndex: 0,
        rows: [
          {
            'Lead Owner': 'agent@growagency.com',
            Name: 'Mohan K',
            'Contact Details': 'mohan@corp.io | +91 99887 76655',
            Extra: 'VIP',
          },
        ],
      },
      headers,
    );
    // The lead's own contact info is recovered, not the agent's.
    expect(records[0]?.email).toContain('mohan@corp.io');
    expect(records[0]?.mobile_without_country_code).toContain('99887');
    expect(records[0]?.lead_owner).toBe('agent@growagency.com');
  });

  it('extracts records and preserves unmapped columns into crm_note', async () => {
    const provider = createFallbackProvider();
    const headers = ['Email', 'Phone', 'Favourite Colour'];
    const records = await provider.extractBatch(
      {
        startIndex: 0,
        rows: [{ Email: 'a@x.com', Phone: '9876543210', 'Favourite Colour': 'blue' }],
      },
      headers,
    );
    expect(records[0]?.email).toBe('a@x.com');
    expect(records[0]?.mobile_without_country_code).toBe('9876543210');
    expect(records[0]?.crm_note).toContain('Favourite Colour: blue');
    expect(records[0]?._row).toBe(0);
  });
});
