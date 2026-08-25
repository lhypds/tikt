import { useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DATE_LOCALES } from "./dates.js";

const TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;
// Roads and labels on white — the same paper the rest of the app is printed on.
const STYLE_URL = "mapbox://styles/mapbox/light-v11";
const SOURCE = "tikt-knots";
const POINT_LAYER = "tikt-knots-point";
const EMPTY_DATA = { type: "FeatureCollection", features: [] };
const MAX_FIT_ZOOM = 15;
const FIT_PADDING = 32;

const MAP_LANGUAGES = { en: "en", zh: "zh-Hans", ja: "ja" };

function collect(knots, format) {
  return {
    type: "FeatureCollection",
    features: knots.map((knot) => ({
      type: "Feature",
      properties: { label: format.format(new Date(knot.time)) },
      geometry: { type: "Point", coordinates: [knot.longitude, knot.latitude] },
    })),
  };
}

function boundsOf(knots) {
  const bounds = new mapboxgl.LngLatBounds();
  for (const knot of knots) bounds.extend([knot.longitude, knot.latitude]);
  return bounds;
}

// `knots` are the located knots the page is currently showing — the day or month
// filter above the map narrows them, and the view follows.
export default function KnotMap({ knots }) {
  const { t, i18n } = useTranslation();
  const locale = DATE_LOCALES[i18n.language] || "en-US";
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const popupRef = useRef(null);
  // The map's own listeners outlive the render that bound them, so what they
  // read lives in refs rather than in props.
  const dataRef = useRef(EMPTY_DATA);
  const initialRef = useRef(knots);
  const languageRef = useRef(MAP_LANGUAGES[i18n.language] ?? "auto");

  const timeFormat = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    [locale],
  );

  dataRef.current = collect(knots, timeFormat);

  useEffect(() => {
    if (!containerRef.current || !TOKEN) return;
    const initial = initialRef.current;
    mapboxgl.accessToken = TOKEN;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      ...(initial.length
        ? { bounds: boundsOf(initial), fitBoundsOptions: { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM } }
        : { center: [0, 20], zoom: 1 }),
      // Set here as well as on style.load, so the first tiles already come back
      // localized instead of arriving in English and being reloaded a moment later.
      language: languageRef.current,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      map.setLanguage(languageRef.current);
      map.addSource(SOURCE, { type: "geojson", data: dataRef.current });
      map.addLayer({
        id: POINT_LAYER,
        type: "circle",
        source: SOURCE,
        paint: {
          "circle-radius": 5,
          "circle-color": "#0b0b0b",
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
    });

    // Tapping a knot says when it was tied — the map answers "where", the popup "when".
    map.on("click", POINT_LAYER, (event) => {
      const feature = event.features?.[0];
      if (!feature) return;
      popupRef.current?.remove();
      popupRef.current = new mapboxgl.Popup({ closeButton: false, offset: 10, className: "knot-map-popup" })
        .setLngLat(feature.geometry.coordinates)
        .setText(feature.properties.label)
        .addTo(map);
    });
    map.on("mouseenter", POINT_LAYER, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", POINT_LAYER, () => {
      map.getCanvas().style.cursor = "";
    });

    const observer = new ResizeObserver(() => map.resize());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      popupRef.current?.remove();
      popupRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // Built once and torn down with the page; the effects below feed it new data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    popupRef.current?.remove();
    popupRef.current = null;
    const apply = () => {
      map.getSource(SOURCE)?.setData(dataRef.current);
      if (knots.length) {
        map.fitBounds(boundsOf(knots), { padding: FIT_PADDING, maxZoom: MAX_FIT_ZOOM, duration: 600 });
      }
    };
    // "style.load" is what adds the source; before it lands there is nothing to feed.
    if (map.isStyleLoaded()) apply();
    else map.once("style.load", apply);
  }, [knots]);

  useEffect(() => {
    languageRef.current = MAP_LANGUAGES[i18n.language] ?? "auto";
    const map = mapRef.current;
    if (!map) return;
    if (map.isStyleLoaded()) map.setLanguage(languageRef.current);
    else map.once("style.load", () => map.setLanguage(languageRef.current));
  }, [i18n.language]);

  return (
    <section className="stats-block">
      {TOKEN ? (
        <div ref={containerRef} className="knot-map" aria-label={t("knotStats.mapAria")} />
      ) : (
        <p className="knot-map-missing">{t("knotStats.mapNoToken")}</p>
      )}
    </section>
  );
}
