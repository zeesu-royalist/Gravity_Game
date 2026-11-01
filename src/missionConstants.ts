import * as THREE from 'three';

export const MOON_POSITION = new THREE.Vector3(2600, 16500, -9200);
export const MOON_RADIUS = 680;
export const MOON_TOUCHDOWN_Y = MOON_POSITION.y + MOON_RADIUS + 0.2;
export const MOON_LANDING_SITE = new THREE.Vector3(MOON_POSITION.x, MOON_TOUCHDOWN_Y, MOON_POSITION.z);

export const EARTH_LANDING_SITE = new THREE.Vector3(0, 0.2, 0);
export const EARTH_CAR_DEFAULT_POS = new THREE.Vector3(-9.5, 0.26, 14.0);
export const EARTH_ASTRONAUT_DEFAULT_POS = new THREE.Vector3(-4.0, 0.26, 8.0);

