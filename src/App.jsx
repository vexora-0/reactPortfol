import React, { useEffect, useState } from 'react';
import './App.css';
import HomePage from './component/HomePage';

function App() {
  const [displayHome, showIntro] = useState(true);
  const body = document.querySelector('body');

  function toggleMode() {
    body.classList.toggle('darkMode');
  }

  useEffect(() => {
    setTimeout(() => {
      showIntro(false);
    }, 1500) 
  },[])

  return (
    <>
    <HomePage />
    </>
  )
}

export default App
