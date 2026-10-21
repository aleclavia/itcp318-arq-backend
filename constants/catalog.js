// KEEP IN SYNC with frontend/src/constants/catalog.js
const CATEGORY_GROUP = {
    'VR Headsets': 'VR',
    'Motion Controllers': 'VR',
    'Base Stations & Trackers': 'VR',
    'Haptic Wearables': 'VR',
    'Racing Wheels': 'Racing',
    'Pedals': 'Racing',
    'Shifters & Handbrakes': 'Racing',
    'Motion Platforms': 'Racing',
    'Rig Frames & Mounts': 'Racing',
    'Flight Sticks & Throttles': 'Flight',
};

module.exports = {
    CATEGORIES: Object.keys(CATEGORY_GROUP),
    CATEGORY_GROUP,
    GROUPS: ['VR', 'Racing', 'Flight'],
    PLATFORMS: ['PC / SteamVR', 'Standalone (Android)', 'PlayStation / PSVR2', 'Xbox'],
    CONNECTION_TYPES: ['USB', 'Bluetooth', 'Proprietary Wireless', 'DisplayPort / HDMI', 'Wi-Fi'],
    PLAY_SPACES: ['None', 'Seated', 'Standing', 'Room-scale'],
    AVAILABILITY: ['in-stock', 'pre-order', 'backordered'],
    ORDER_STATUSES: ['Processing', 'Shipped', 'Delivered'],
};
