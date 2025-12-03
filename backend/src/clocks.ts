export type Clock = {
  id: string
  plant: string
  label: string
  ip: string
  baseUrl: string
}

export const clocks: Clock[] = [
  {
    id: 'brta-rep-01',
    plant: 'BRTA',
    label: 'REP 01',
    ip: '192.168.100.10',
    baseUrl: 'http://192.168.100.10',
  },
  {
    id: 'brta-rep-02',
    plant: 'BRTA',
    label: 'REP 02',
    ip: '192.168.100.11',
    baseUrl: 'http://192.168.100.11',
  },
  {
    id: 'brta-rep-03',
    plant: 'BRTA',
    label: 'REP 03',
    ip: '192.168.100.12',
    baseUrl: 'http://192.168.100.12',
  },
  {
    id: 'brta-rep-04',
    plant: 'BRTA',
    label: 'REP 04',
    ip: '192.168.100.13',
    baseUrl: 'http://192.168.100.13',
  },
  {
    id: 'brta-rep-05',
    plant: 'BRTA',
    label: 'REP 05',
    ip: '192.168.100.14',
    baseUrl: 'http://192.168.100.14',
  },
  {
    id: 'brta-rep-06',
    plant: 'BRTA',
    label: 'REP 06',
    ip: '192.168.100.15',
    baseUrl: 'http://192.168.100.15',
  },
  {
    id: 'brta-rep-07',
    plant: 'BRTA',
    label: 'REP 07',
    ip: '192.168.100.16',
    baseUrl: 'http://192.168.100.16',
  },
  {
    id: 'brta-rep-08',
    plant: 'BRTA',
    label: 'REP 08',
    ip: '192.168.100.17',
    baseUrl: 'http://192.168.100.17',
  },
  {
    id: 'brgo-rep-01',
    plant: 'BRGO',
    label: 'REP 01',
    ip: '192.168.200.10',
    baseUrl: 'http://192.168.200.10',
  },
  {
    id: 'brgo-rep-02',
    plant: 'BRGO',
    label: 'REP 02',
    ip: '192.168.200.11',
    baseUrl: 'http://192.168.200.11',
  },
]
