import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faReact, faHtml5, faCss3, faJsSquare } from '@fortawesome/free-brands-svg-icons';
import viteSVG from '../assets/svg/viteLogo.svg';
import netlifySVG from '../assets/svg/netlifyLogo.svg';
import '../css/Projects.css';
import webGenerator from '../assets/WebsiteGenerator.jpg';
import { faArrowLeft, faArrowRight, faCircle } from '@fortawesome/free-solid-svg-icons';
import Calculator from '../assets/Calcutor.jpg';
import moviereview from '../assets/moviereview.jpg';



export default function Projects() {
  const [activeIndex, setCurrentIndex] = useState(0);
  const reactLogo = <FontAwesomeIcon icon={faReact} style={{color:'cyan'}}/>
  const htmlLogo = <FontAwesomeIcon icon={faHtml5}  style={{color:'orangered'}}/>
  const cssLogo = <FontAwesomeIcon icon={faCss3}  style={{color:'blue'}}/>
  const jsLogo = <FontAwesomeIcon icon={faJsSquare}  style={{color:'gold'}}/>  
  const netlifyLogo = <img src={netlifySVG} className='netlifyLogo' alt="Netlify Logo"/>;
  const viteLogo = <img src={viteSVG} className='viteLogo' alt="Vite Logo"/>;


  function updateIndex(newIndex) {
    newIndex < 0
      ? newIndex = 0
      : newIndex >= projects.length 
      ? newIndex = projects.length - 1 
      : newIndex
    setCurrentIndex(newIndex);
  }

  const projects = [
    {
      name: "Basic Image Editor",
      techstack: (
        <>
        <p>Java</p>
        </>
      ),
      dependencies: (
        <>
          <p>JavaFX</p>
        </>
      ),
      description: (
        <>
          <p>
            This is a basic image editor created using Java, providing essential 
            image manipulation features within a simple and intuitive interface. 
            The editor includes <em>basic functionality such as cropping, rotating, 
            and resizing images</em>, as well as <em>color adjustments like brightness, 
            contrast, and saturation</em>. Users can also apply a range of filters to 
            enhance their images. The application supports <em>undo and redo actions</em>, 
            ensuring a flexible and user-friendly experience. The image editor is designed 
            to be lightweight yet powerful, catering to everyday image editing needs.
         </p>
        </>
      ),
      demoUrl: "https://github.com/vexora-0?tab=repositories",
      image: webGenerator,
    },  
    {
      name: "Movie review site",
      techstack: (
        <>
          {viteLogo}
          {reactLogo}
          {jsLogo}
        </>
      ),
      dependencies: (
        <>{viteLogo}
          <p>React Context</p>
        </>
      ),
      description: (
        <>
          <p>
            This is a basic movie review site built using JavaScript, React, and Vite. 
            It allows users to search for movies, read and write reviews, and rate films. 
            Each movie has its own page with details like the title, release date, and synopsis. 
            Users can create accounts to log in and track their reviews and ratings. 
            Built with React and optimized with Vite, the site offers a fast and responsive 
            experience, fostering a community for movie enthusiasts to share their opinions 
            and discover new films.
          </p>

        </>
      ),
      demoUrl: "https://github.com/vexora-0?tab=repositories",
      image: moviereview,
    },
    {
      name: "Basic Calculator",
      techstack: (
        <>
          {htmlLogo}
          {cssLogo}
          {jsLogo}
        </>
      ),
      dependencies: <>{viteLogo}</>,
      description: (
        <>
          <p>
            This is a basic calculator program built using Java. It provides essential 
            arithmetic operations such as addition, subtraction, multiplication, and 
            division. The calculator features a simple and intuitive interface with 
            buttons for digits and operations, as well as a display screen to show 
            current calculations and results. Designed to be lightweight and efficient, 
            this Java-based calculator is perfect for everyday use, offering reliable 
            performance and ease of use.
          </p>

        </>
      ),
      demoUrl: "https://github.com/vexora-0?tab=repositories",
      image: Calculator,
    },
  ];

  return (
    <div className="projectWheelContainer" onTouchMove={updateIndex}>
      <div
        className="projectWheel"
        style={{ transform: `translate(-${activeIndex * 100}%)` }}
      >
        {projects.map((project, index) => {
          return (
            <section className="project" key={index}>
              <div className='projectImg'>
                <img src={project.image} />
              </div>
              <div className='projectInfo'>
                <h3>{project.name}</h3>
                <div className='projectStacks'>
                  {project.techstack}
                </div>
                <div className='projectDeps'>
                  {project.dependencies}
                </div>
                <div className='projectDesc'>
                  {project.description}
                </div>
                <a target='_blank' href={project.demoUrl}>Github</a>
              </div>
            </section>
          );
        })}
      </div>

      <div className="wheel-btns">
        <button
          className="btn-arrow"
          onClick={() => {
            updateIndex(activeIndex - 1);
          }}
        >
          <span>
            <FontAwesomeIcon icon={faArrowLeft} />
          </span>{" "}
        </button>
        <div className="indicators">
          {projects.map((project, index) => {
            return (
              <button
                className="indicator-btns"
                onClick={() => {
                  updateIndex(index);
                }}>
                <span className={
                  `${index === activeIndex
                      ? "indicator-symbol-active"
                      : "indicator-symbol"
                    }`
                  }>
                  <FontAwesomeIcon icon={faCircle} />
                </span>
              </button>
            );
          })}
        </div>
        <button
          className="btn-arrow"
          onClick={() => {
            updateIndex(activeIndex + 1);
          }}
        >
          <span>
            <FontAwesomeIcon icon={faArrowRight} />
          </span>
        </button>
      </div>
    </div>
  );
}
