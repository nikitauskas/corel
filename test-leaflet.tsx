import L from "leaflet";
import proj4 from "proj4";

(window as any).proj4 = proj4;
require("proj4leaflet");

console.log(L.Proj.CRS);
