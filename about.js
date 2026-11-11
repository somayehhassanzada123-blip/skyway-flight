"use strict";

const destinations = [
  {
    city: "Istanbul",
    country: "Turkey",
    description: "Discover historic mosques and beautiful streets.",
    image: "photo-1541432901042-2d8bd64b4a9b",
  },

  {
    city: "Dubai",
    country: "UAE",
    description: "Experience luxury, shopping and modern architecture.",
    image: "photo-1512453979798-5ea266f8880c",
  },

  {
    city: "Paris",
    country: "France",
    description: "Explore romantic streets and the Eiffel Tower.",
    image: "photo-1502602898657-3e91760cbb34",
  },

  {
    city: "London",
    country: "United Kingdom",
    description: "Discover famous landmarks and British culture.",
    image: "photo-1513635269975-59663e0ac1ad",
  },

  {
    city: "Agra",
    country: "India",
    description: "Visit the beautiful and historic Taj Mahal.",
    image: "photo-1564507592333-c60657eea523",
  },

  {
    city: "Hunza",
    country: "Pakistan",
    description: "Enjoy breathtaking mountains and nature.",
    image: "photo-1597074866923-dc0589150358",
  },

  {
    city: "Kabul",
    country: "Afghanistan",
    description: "Discover Afghan culture and beautiful landscapes.",
    image: "photo-1500530855697-b586d89ba3ee",
  },

  {
    city: "Tehran",
    country: "Iran",
    description: "Explore Persian culture and architecture.",
    image: "photo-1524492412937-b28074a5d7da",
  },

  {
    city: "Doha",
    country: "Qatar",
    description: "Discover modern architecture and Arabian hospitality.",
    image: "photo-1533105079780-92b9be482077",
  },

  {
    city: "Riyadh",
    country: "Saudi Arabia",
    description: "Explore Arabian culture and modern attractions.",
    image: "photo-1512453979798-5ea266f8880c",
  },

  {
    city: "Dushanbe",
    country: "Tajikistan",
    description: "Enjoy mountain views and beautiful city life.",
    image: "photo-1500534623283-312aade485b7",
  },

  {
    city: "Samarkand",
    country: "Uzbekistan",
    description: "Explore the historic Silk Road.",
    image: "photo-1516483638261-f4dbaf036963",
  },

  {
    city: "Kuala Lumpur",
    country: "Malaysia",
    description: "Visit famous towers and tropical attractions.",
    image: "photo-1596422846543-75c6fc197f07",
  },

  {
    city: "Bangkok",
    country: "Thailand",
    description: "Discover colorful markets and beautiful temples.",
    image: "photo-1508009603885-50cf7c579365",
  },

  {
    city: "Rome",
    country: "Italy",
    description: "Explore ancient monuments and Italian culture.",
    image: "photo-1515542622106-78bda8ba0e5b",
  },

  {
    city: "Tokyo",
    country: "Japan",
    description: "Experience modern technology and Japanese culture.",
    image: "photo-1540959733332-eab4deabeeaf",
  },

  {
    city: "Berlin",
    country: "Germany",
    description: "Discover historical landmarks and modern city life.",
    image: "photo-1560969184-10fe8719e047",
  },

  {
    city: "Beijing",
    country: "China",
    description: "Explore ancient history and the Great Wall.",
    image: "photo-1508804185872-d7badad00f7d",
  },
];


const destinationGrid = document.getElementById("destinationGrid");

const viewAllBtn = document.getElementById("viewAll");

let isExpanded = false;


function displayDestinations() {
  destinationGrid.innerHTML = "";

  destinations.forEach((place, index) => {
    const card = document.createElement("article");

    card.className = "destination-card";

    if (index >= 4) {
      card.classList.add("extra-card");
    }

    card.style.animationDelay = `${(index % 4) * 0.1}s`;

    card.innerHTML = `

            <img

                src="https://images.unsplash.com/${place.image}?auto=format&fit=crop&w=700&q=85"

                alt="${place.city}, ${place.country}"

                loading="lazy"

            >

            <span class="destination-number">

                ${String(index + 1).padStart(2, "0")}

            </span>


            <div class="destination-info">

                <h3>${place.city}</h3>

                <p>${place.country}</p>

            </div>


            <span class="location-icon">

                ⌖

            </span>


            <div class="destination-details">

                <h3>${place.city}</h3>

                <p>${place.description}</p>

                <button

                    class="explore-btn"

                    data-city="${place.city}"

                    data-country="${place.country}"

                >

                    Explore More ↗

                </button>

            </div>

        `;

    destinationGrid.appendChild(card);
  });
}

displayDestinations();


viewAllBtn.addEventListener("click", () => {
  isExpanded = !isExpanded;

  const extraCards = document.querySelectorAll(".extra-card");

  extraCards.forEach((card, index) => {
    if (isExpanded) {
      card.classList.add("show");

      card.style.animationDelay = `${(index % 4) * 0.08}s`;
    } else {
      card.classList.remove("show");
    }
  });

  if (isExpanded) {
    viewAllBtn.innerHTML = "Show Less <span>↑</span>";
  } else {
    viewAllBtn.innerHTML = "View All <span>→</span>";
  }
});



destinationGrid.addEventListener("click", (event) => {
  const button = event.target.closest(".explore-btn");

  if (!button) return;

  const city = button.dataset.city;

  const country = button.dataset.country;

  const destinationSelect = document.getElementById("destination");

  if (destinationSelect) {
    const option = [...destinationSelect.options].find(
      (item) => item.value === country,
    );

    if (option) {
      destinationSelect.value = country;
    }
  }

  const message = document.getElementById("formMessage");

  if (message) {
    message.textContent = `You selected ${city}, ${country}.`;
  }

  const journey = document.getElementById("journey");

  if (journey) {
    journey.scrollIntoView({
      behavior: "smooth",
    });
  }
});

console.log("All SkyWay destinations loaded!");


// Light / dark theme controls
(() => {
  const root = document.documentElement;
  const themeButton = document.querySelector("[data-sw-theme-toggle]");
  if (!themeButton || themeButton.dataset.themeReady === "true") return;
  themeButton.dataset.themeReady = "true";

  const storageKey = "skyway-theme";
  let savedTheme = null;
  try {
    savedTheme = localStorage.getItem(storageKey);
  } catch (_) {
    // The theme still works for this page when storage is unavailable.
  }

  const initialTheme = savedTheme === "light" || savedTheme === "dark"
    ? savedTheme
    : "dark";

  const applyTheme = (theme) => {
    root.dataset.theme = theme;
    const nextTheme = theme === "dark" ? "light" : "dark";
    themeButton.setAttribute("aria-label", `Switch to ${nextTheme} theme`);
    themeButton.setAttribute("title", `Switch to ${nextTheme} theme`);
  };

  applyTheme(initialTheme);

  themeButton.addEventListener("click", () => {
    const nextTheme = root.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme);
    try {
      localStorage.setItem(storageKey, nextTheme);
    } catch (_) {
      // Theme switching remains available for the current page.
    }
  });
})();
