import { useEffect, useState } from 'react';
import { CloudSun, Pencil } from 'lucide-react';
import styles from './WeatherWidget.module.css';

const KEY_STORE  = 'homehub-weather-key';
const CITY_STORE = 'homehub-weather-city';

interface WeatherData {
  temp: number;
  feels_like: number;
  description: string;
  icon: string;
  city: string;
}

export default function WeatherWidget() {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(KEY_STORE) ?? '');
  const [city, setCity]     = useState(() => localStorage.getItem(CITY_STORE) ?? '');
  const [data, setData]     = useState<WeatherData | null>(null);
  const [error, setError]   = useState('');
  const [configuring, setConfiguring] = useState(!apiKey || !city);

  useEffect(() => {
    if (!apiKey || !city) return;
    fetch(`https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&appid=${apiKey}&units=metric`)
      .then((r) => r.json())
      .then((d) => {
        if (d.cod !== 200) { setError(d.message ?? 'Error'); return; }
        setData({
          temp: Math.round(d.main.temp),
          feels_like: Math.round(d.main.feels_like),
          description: d.weather[0].description,
          icon: `https://openweathermap.org/img/wn/${d.weather[0].icon}@2x.png`,
          city: d.name,
        });
        setError('');
      })
      .catch(() => setError('Network error'));
  }, [apiKey, city]);

  function saveConfig(e: React.FormEvent) {
    e.preventDefault();
    localStorage.setItem(KEY_STORE, apiKey);
    localStorage.setItem(CITY_STORE, city);
    setConfiguring(false);
  }

  if (configuring) {
    return (
      <div className={styles.root}>
        <h3 className={styles.title}><CloudSun size={14} /> Weather</h3>
        <form onSubmit={saveConfig} className={styles.form}>
          <input className="input" placeholder="City (e.g. Miami)" value={city} onChange={(e) => setCity(e.target.value)} required />
          <input className="input" placeholder="OpenWeatherMap API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} required />
          <button type="submit" className="btn btn--primary btn--sm">Save</button>
        </form>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <h3 className={styles.title}>
        🌤 {data?.city ?? city}
        <button className={styles.editBtn} onClick={() => setConfiguring(true)} title="Edit"><Pencil size={12} /></button>
      </h3>
      {error && <p className={styles.error}>{error}</p>}
      {data && !error && (
        <div className={styles.weather}>
          <img src={data.icon} alt={data.description} className={styles.icon} />
          <span className={styles.temp}>{data.temp}°C</span>
          <span className={styles.desc}>{data.description}</span>
          <span className={styles.feels}>Feels like {data.feels_like}°C</span>
        </div>
      )}
    </div>
  );
}
