export default {
  availableExhibits: [], // An array of strings
  componentGroups: [],
  currentExhibit: '',
  errorDict: {},
  exhibitComponents: [],
  groups: [],
  groupLastUpdateDate: 0,
  issueList: [],
  MAINTANANCE_STATUS: {
    'On floor, working': { name: 'On floor, working', value: 1, colorClass: 'btn-success' },
    'Off floor, working': { name: 'Off floor, working', value: 2, colorClass: 'btn-info' },
    'Off floor, not working': { name: 'Off floor, not working', value: 3, colorClass: 'btn-warning' },
    'On floor, not working': { name: 'On floor, not working', value: 4, colorClass: 'btn-danger' }
  },
  scheduleUpdateTime: 0,
  serverAddress: '',
  serverSoftwareUpdateAvailable: false,
  STATUS: {
    STATIC: { name: 'STATIC', value: 0, colorClass: 'btn-secondary' },
    ACTIVE: { name: 'ACTIVE', value: 1, colorClass: 'btn-primary' },
    ONLINE: { name: 'ONLINE', value: 1, colorClass: 'btn-success' },
    STANDBY: { name: 'STANDBY', value: 2, colorClass: 'btn-info' },
    WAITING: { name: 'WAITING', value: 3, colorClass: 'btn-warning' },
    'SYSTEM ON': { name: 'SYSTEM ON', value: 4, colorClass: 'btn-info' },
    UNKNOWN: { name: 'UNKNOWN', value: 5, colorClass: 'btn-warning' },
    OFFLINE: { name: 'OFFLINE', value: 6, colorClass: 'btn-danger' }
  },
  user: {
    permissions: {}
  },
  usersDisplayNameCache: {}
}
