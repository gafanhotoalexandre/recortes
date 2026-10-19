import { expect, it } from 'vitest'
import headers from '../../../security-headers.json'
import config from '../../../vercel.json'

it('preview verifica os mesmos headers preparados para a hospedagem estática', () => {
  expect(
    Object.fromEntries(config.headers[0]!.headers.map((header) => [header.key, header.value])),
  ).toEqual(headers)
  expect(headers['Content-Security-Policy']).not.toContain('unsafe-eval')
})
