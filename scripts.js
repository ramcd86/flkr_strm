"use strict";

const LOCAL_SESSION = "local_session_01";

/*
 *
 *  MAIN APPLICATION.
 *
 */

class Main {
  /*
   * Initialise with page number 1, we'll increment this as we scroll through pages.
   */
  static pageNumber = 1;

  /*
   * Initialise the session state, this needs to be static so we can access it from the external-facing functions.
   */
  static favouritesFromSession = { favourites: [] };

  /*
   *  Static object favouriteImage serves as a dirty observable so we can bind an in-class function to an out of class event.
   */
  static favouriteImage = {
    imageInternal: "",
    internalListener: (val) => {},
    modalPopulator: () => {},
    set image(val) {
      this.imageInternal = val;
      this.internalListener(val);
      this.modalPopulator();
    },
    get image() {
      return this.imageInternal;
    },
    bindListener: function (listener, modalPopulation) {
      this.internalListener = listener;
      this.modalPopulator = modalPopulation;
    },
  };

  constructor() {
    this.init();
  }

  /*
   *  Bootstrap our App.
   */
  init() {
    Main.favouriteImage.bindListener(
      this.registerFavourite,
      this.populateModal
    );
    this.constructImageSet();
    this.constructFavouritesModal();
    this.createSession();
  }

  /*
   *  Set up some default page event listeners, mostly to do with favourites.
   */
  constructFavouritesModal() {
    let favesAreShown = false;
    const faveLink = document.getElementById("faveLink");
    const faveModelWrapper = document.getElementById("favesWrapper");
    const closeFaves = document.getElementById("closeFaves");
    const handleModalAction = () => {
      if (favesAreShown) {
        faveModelWrapper.classList.value = "";
        faveModelWrapper.classList.add("faves-wrapper-out");
      }
      if (!favesAreShown) {
        faveModelWrapper.classList.value = "";
        faveModelWrapper.classList.add("faves-wrapper-in");
      }
      favesAreShown = !favesAreShown;
    };
    faveLink.addEventListener("click", handleModalAction);
    closeFaves.addEventListener("click", handleModalAction);
  }

  /*
   *  Create a new session storage entry for local session state.
   */
  createSession() {
    if (window.sessionStorage.getItem(LOCAL_SESSION)) {
      Main.favouritesFromSession = JSON.parse(
        window.sessionStorage.getItem(LOCAL_SESSION)
      );
      this.populateModal();
    }
    window.sessionStorage.setItem(LOCAL_SESSION, '{ "favourites": [] }');
  }

  /*
   *  Fetch an image set with initial parameters, these params need a default value for pageLoad.
   */
  constructImageSet(perPage = 12, pageNumber = 1) {
    fetch(
      connectionBuilder(
        `per_page=${perPage}&page=${pageNumber}&extras=description,owner_name`
      )
    ).then((c) =>
      c.json().then((j) => {
        // Here's where the magic happens.
        this.insertImages(j.photos.photo, pageNumber);
      })
    );
  }

  /*
   *  Populate the Modal with our Favourites.
   */
  populateModal() {
    let constructedSelectedFavouritesMarkup = "";
    const faveModalContent = document.getElementById("favesList");
    const favesLink = document.getElementById("faveLink");

    faveModalContent.innerHTML = "";
    Main.favouritesFromSession.favourites.forEach((favourite) => {
      constructedSelectedFavouritesMarkup += imageMarkupBuilder({
        imageUrl: favourite.imageUrl,
        title: favourite.title,
        ownername: favourite.ownername,
        index: undefined,
        pageNumber: -1,
      });
    });

    favesLink.innerHTML = `My Favourites (${Main.favouritesFromSession.favourites.length}) &#x2665;`;

    faveModalContent.innerHTML =
      constructedSelectedFavouritesMarkup.length > 0
        ? constructedSelectedFavouritesMarkup
        : "<p>No favourites selected!</p>";
  }

  /*
   *  Get the imageUrl, title, and ownername of the favourited item, validate it isn't already in the favourites List, and add it.
   */
  registerFavourite(val) {
    const favouriteItemValues = {
      imageUrl: val.getAttribute("data-imageUrl"),
      title: val.getAttribute("data-title"),
      ownername: val.getAttribute("data-ownername"),
    };
    if (
      !Main.favouritesFromSession.favourites.find(
        (faveItem) => faveItem.imageUrl === favouriteItemValues.imageUrl
      )
    ) {
      Main.favouritesFromSession.favourites.push(favouriteItemValues);
    }
    window.sessionStorage.setItem(
      LOCAL_SESSION,
      JSON.stringify(Main.favouritesFromSession)
    );
  }

  /*
   *  Get a list of image properties and the current page.
   */
  insertImages(imageList, pageNumber) {
    let imageInsertionString = "";
    const main = document.getElementById("main");
    const newImageSet = document.createElement("div");

    // Cycle through each image property and build up the HTML markup using the imageMarkupBuilder() method with IMG url strings built from our incoming data.
    imageList.forEach(
      (imgData, index) =>
        (imageInsertionString += imageMarkupBuilder({
          imageUrl: `https://live.staticflickr.com/${imgData.server}/${imgData.id}_${imgData.secret}.jpg`,
          title: imgData.title,
          ownername: imgData.ownername,
          index: index,
          pageNumber: pageNumber,
        }))
    );

    // Insert the newly generated markup string into our created Div element, and append it to the main div.
    newImageSet.innerHTML = imageInsertionString;
    main.appendChild(newImageSet);

    // Initialise or RE-initialise our intersection observer
    this.initDocumentObserver(pageNumber);
  }

  /*
   *  Set up an intersection observer which watches for a specifically tagged div to scroll into view.
   */
  initDocumentObserver(pageNumber) {
    const intersectionalityMonitor = (changes) => {
      for (const change of changes) {
        if (change.isIntersecting) {
          // Unsubscribe from the current element once its in view.
          observer.unobserve(currentImageBreakpoint);

          // Start building a new image set with new data incremented to the next page of data.
          this.constructImageSet(12, Main.pageNumber + 1);
        }
      }
    };
    const currentImageBreakpoint = document.getElementById(
      `page-${pageNumber}`
    );
    const observer = new IntersectionObserver(intersectionalityMonitor);
    observer.observe(currentImageBreakpoint);
  }
}

/*
 *
 *  UTILITY FUNCTIONS.
 *
 */

/*
 *  Build a markup set of images and return them. Assign button clicks to the static in-class method (more memory efficient than adding a bunch of event listeners.)
 *  Add a special div which acts as an anchor for the intersectionalObserver to monitor to see if we need to load a new page of images.
 */
function imageMarkupBuilder(imageDataObject) {
  const { imageUrl, title, ownername, index, pageNumber } = imageDataObject;
  // Use the pageNumber to decide whether or not we're building an image set for the Favourites or the Main page.
  if (pageNumber === -1) {
    return `
        <div class="favourites-item">
            <div style="background-image: url('${imageUrl}');" class="favourites-image">
                <div class="favourites-info">
                    <span>${title ? title : "No Title"}</span>
                    <span>${ownername}</span>
                </div>
            </div>
        </div> 
      `;
  } else {
    Main.pageNumber = pageNumber;
    return `
        <div class="image-container">
            <div style="background-image: url('${imageUrl}');" class="image-actual">
                <div class="image-info">
                        <p><strong>${title ? title : "No Title"}</strong></p>
                        <div class="image-hr"></div>
                        <p><i>${ownername}</i></p>
                        <button id="button-${index}" 
                        data-imageUrl="${imageUrl}" 
                        data-title="${title}"
                        data-ownername="${ownername}"
                        onclick="(Main.favouriteImage.image = this)">Favourite</button>
                </div>
            </div>
        </div>
        ${
          index === 8
            ? '<div id="page-' +
              pageNumber +
              '" style="width: 100%; height: 0px; display: block;"></div>'
            : ""
        }
    `;
  }
}

/*
 *  Separate strings and validation for our connection and return our completed query string.
 */
function connectionBuilder(params = "") {
  const connection = {
    baseUrl:
      "https://api.flickr.com/services/rest/?method=flickr.photos.getRecent&api_key=",
    apiKey: "f99080079c53b6015480170492bd3eeb",
    urlCap: "format=json&nojsoncallback=1",
  };
  return `${connection.baseUrl + connection.apiKey}&${params}&${
    connection.urlCap
  }`;
}

/*
 *
 *  BOOTSTRAP.
 *
 */

window.addEventListener("DOMContentLoaded", () => {
  new Main();
  console.log(
    `%c
  
  
            .   ,       .         . 
            |  /  o     |         | 
            | /   . ;-. |-  ,-. ,-| 
            |/    | | | |   |-' | | 
            '     ' ' ' \`-' \`-' \`-' 
            
      [ TECHNICAL TEST BY ROSS MCDERMOTT. ]
                                               
                                                    
  `,
    "color: #07ACB4"
  );
});
