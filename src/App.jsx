import { Routes, Route } from 'react-router-dom';
import { HomeSelector } from './components/HomeSelector';
import { FormularioProfesional } from './components/FormularioProfesional';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeSelector />} />
      <Route path="/:slug" element={<FormularioProfesional />} />
    </Routes>
  );
}