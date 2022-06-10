//var string = "Zaken simpel maken is het moeilijkste wat er is. Wij helpen verder online.";
var string = "Brik is een digital design en development bureau. Wij bedenken, ontwerpen en realiseren je digitale ambities.";
var str = string.split("");
//var string2 = "Wij helpen verder online.";
//var str2 = string2.split("");
var el = document.getElementById('str');
//var el2 = document.getElementById('str2');
var svgLogo = document.getElementById('svgLogo');
var header = document.getElementById('homeHeader');
var body = document.getElementsByTagName('body');
var menuContainer = document.getElementsByClassName('menuContainer');
var menuContainers = document.querySelectorAll('.menuContainer');
var menuButtons = document.querySelectorAll('.menuIcon .hamburger');
var isIE11 = !!window.MSInputMethodContext && !!document.documentMode;
var skipIntro = getCookie('skipIntro');

if(isIE11) {
    body[0].classList.add('thisIsIE11-Juck')
}

if(skipIntro != 'true' && header != null) {
    window.scrollTo(0, 0);
    header.classList.add('animated');
    (function animate() {
        if (el != null) {
            str.length > 0 ? el.innerHTML += str.shift() : clearTimeout(running);
            var lazyloadImage = document.querySelectorAll('#projectsContainer img.lazyload');
            for (var i = 0, len = lazyloadImage.length; i < len; i++) {
                var imageToLoad = lazyloadImage[i];
                lazySizes.loader.unveil(imageToLoad);
            }
            if (el.innerHTML.length < string.length) {
                var running = setTimeout(animate, (Math.floor(Math.random() * 20) + 25));
            } else {
                svgLogo.classList.remove('noStroke');
                header.classList.add('animate');
                subtitle.classList.add('animate');
                if(isIE11) {
                    header.classList.add('animateie11');
                }
                setTimeout(function () {
                    body[0].classList.remove('bounded');
                    menuContainer[0].classList.add('show');
                }, 2000);
                setCookie('skipIntro', 'true', 1);
            }
        }
    })();
} else {
    if(el != null) {
        el.innerHTML = string;
        body[0].classList.remove('bounded');
        svgLogo.classList.remove('noStroke');
        header.classList.add('show');
        menuContainer[0].classList.add('show');
    }
}

var sticky = new Sticky('.sticky');
window.document.addEventListener('stuck', function() {
    header.classList.add('isStuck');

    var lazyloadImage = document.querySelectorAll('#projectsContainer img.lazyload');
    for (var i = 0, len = lazyloadImage.length; i < len; i++) {
        var imageToLoad = lazyloadImage[i];
        lazySizes.loader.unveil(imageToLoad);
    }
});
window.document.addEventListener('unstuck', function() {
    header.classList.remove('isStuck');
});

var clearProject = null;
var links = document.querySelectorAll('.namesList a');
var changeBodyColor = null;

if(is_touch_device()) {
    document.body.classList.add('touchy');

    var windowHeight = (Math.max(document.documentElement.clientHeight, window.innerHeight || 0))/2;


    window.addEventListener('scroll', function () {
        for (var i = 0, len = links.length; i < len; i++) {
            projectLink = links[i];
            if(projectLink.getBoundingClientRect().y < (windowHeight + 50) && projectLink.getBoundingClientRect().y > (windowHeight - 50) - projectLink.getBoundingClientRect().height) {
                projectLink.classList.add('active');
                activateProject(projectLink);
            } else {
                projectLink.classList.remove('active');
            }
        }

        var activeProjectLinks = document.querySelectorAll('#namesList a.active');
        if(activeProjectLinks.length == 0) {
            clearProjects();
        }
    });



} else {

    [].forEach.call(links, function (link) {

        link.addEventListener('mouseenter', function () {
            activateProject(this);
        });

        link.addEventListener('mouseleave', function () {
            clearProjects();
        });
    });
}

docReady(function() {
    loadContentPage();
});

function clearProjects() {
    clearProject = setTimeout(function() {
        clearBodyColor();
        if(changeBodyColor != null) {
            clearTimeout(changeBodyColor);
        }
        clearShownImages();
    }, 100);
}

function activateProject(linkElm) {
    if (clearProject != null) {
        clearTimeout(clearProject);
    }
    var imageClass = linkElm.getAttribute('data-class');
    if (imageClass != null) {

        var projectElm = document.querySelector('.project.' + imageClass);

        if (projectElm != null) {
            clearKeepOpen();
            clearShownImages();
            projectElm.classList.add('show');
            if(changeBodyColor != null) {
                clearTimeout(changeBodyColor);
            }
            changeBodyColor = setTimeout(function() {
                clearBodyColor();
                var colorClass = projectElm.getAttribute('data-color');
                if(colorClass != null) {
                    document.body.classList.add(colorClass);
                }
            },1000);
        }
    }
}


/// SETUP MENU
for (var i = 0, len = menuButtons.length; i < len; i++) {
    menuButtons[i].addEventListener('click', function(){
        this.classList.toggle('is-active');
        if(menuContainers.length > 0) {
            var menuContainer = menuContainers[0];
            menuContainer.classList.toggle('is-active');
        }
    });
}

// SETUP OFF CANVAS
var canviElms = document.querySelectorAll('.canvi-navbar');
if(canviElms.length > 0) {
    var canviContent = new Canvi({
        content: '.canvi-content',
        navbar: '.canvi-navbar',
        position: 'right',
        pushContent: false,
        width: '90vw'
    });
}

// SETUP AJAX CONTENT CALLS

var canvasContent = document.getElementById('ajaxContentContainer');
document.querySelector('body').addEventListener('click', function(e) {
    var matches = event.target.matches ? event.target.matches('.ajaxContent') : event.target.msMatchesSelector('.ajaxContent');
    if (matches) {
        e.preventDefault();


        var linkElm = event.target;

        // Check if this was a project link to lock the project
        var dataClass = linkElm.getAttribute('data-class');
        if(dataClass != null) {
            var projectElm = document.querySelector('.project.' + dataClass);
            if (projectElm != null) {
                projectElm.classList.add('keepOpen');
            }
        }

        var linkUrl = linkElm.getAttribute('href');
        var linkTarget = linkElm.getAttribute('target');

        if(linkUrl != null) {
            if (linkTarget == null || linkTarget != '_blank') {

                loadAjaxContent(linkUrl);
                history.pushState('async|'+linkUrl, null, linkUrl);

            } else if (linkTarget != '_blank') {
                window.open(linkUrl);
            }
        }
    }
});

if(canvasContent != null) {
    canvasContent.addEventListener('click', function (e) {
        var matches = event.target.matches ? event.target.matches('.backButton') : event.target.msMatchesSelector('.backButton');
        if (matches) {
            e.preventDefault();
            canviContent.close();
        }
    });
}

window.addEventListener('popstate', function(e) {
    e.preventDefault();
    if(e.state != null) {
        var stateData = e.state.split('|');

        if(stateData[0] == 'async') {

            if(canvasContent != null) {
                if (stateData[1] != null) {
                    loadAjaxContent(stateData[1]);
                } else {
                    canviContent.close();
                    canvasContent.innerHTML = '';
                }
            } else {
                window.location = stateData[1];
            }
        } else {
            window.location = stateData[1];
        }
    } else {
        if(canvasContent != null) {
            canviContent.close();
            canvasContent.innerHTML = '';
        } else {
            window.location = '/';
        }
    }
});

/*document.querySelector('body').addEventListener('canvi.before-open', function(e) {
    console.log('Catch Canvi before-open event...');
})*/

// SETUP CONTENT PAGES

function loadContentPage() {

    Array.prototype.slice.call(document.querySelectorAll('.contentSlider')).forEach(function (element, index) {
        lory(element, {

        });
    });

    var floatingLabelInputs = document.querySelectorAll('.floatingLabel input, .floatingLabel textarea');
    for (var i = 0, len = floatingLabelInputs.length; i < len; i++) {
        var input = floatingLabelInputs[i];
        input.addEventListener("focus", function(e) {
            this.parentNode.classList.add('hasValue');
            this.parentNode.classList.add('hasFocus');
        });
        input.addEventListener("blur", function(e) {
            if (this.value.length == 0) {
                this.parentNode.classList.remove('hasValue');
            }
            this.parentNode.classList.remove('hasFocus');
        });
    }
    var fileInputs = document.querySelectorAll('input[type=file]');
    for (var i = 0, len = fileInputs.length; i < len; i++) {
        var input = fileInputs[i];
        input.addEventListener("change", function(e) {
            var fullPath = this.value;
            if (fullPath) {
                var startIndex = (fullPath.indexOf('\\') >= 0 ? fullPath.lastIndexOf('\\') : fullPath.lastIndexOf('/'));
                var filename = fullPath.substring(startIndex);
                if (filename.indexOf('\\') === 0 || filename.indexOf('/') === 0) {
                    filename = filename.substring(1);
                }
                var labelElement = this.parentNode.querySelector('label[for='+this.id+']');
                labelElement.innerHTML = filename;
            }
        });
    }

    document.addEventListener('input', function (event) {
        if (event.target.tagName.toLowerCase() !== 'textarea') return;
        autoExpand(event.target);
    }, false);

    var ajaxForms = document.querySelectorAll('form.ajaxForm');

    for (var i = 0, len = ajaxForms.length; i < len; i++) {
        var form = ajaxForms[i];
        if (!form.classList.contains('processed')) {
            form.classList.add('processed');
            var pristine = new Pristine(form);

            form.addEventListener("submit", function(e) {
                e.preventDefault();

                var formIsValid = pristine.validate();
                if (formIsValid) {
                    var form = e.target;
                    var inputs = form.querySelectorAll('input[type="file"]:not([disabled])')
                    inputs.forEach(function(input) {
                        if (input.files.length > 0) return
                        input.setAttribute('disabled', '')
                    })
                    var data = new FormData(form)
                    inputs.forEach(function(input) {
                        input.removeAttribute('disabled')
                    })
                    var submitButton = form.querySelector('button[type=submit]');
                    submitButton.classList.add('loading');

                    var request = new XMLHttpRequest()

                    request.onreadystatechange = function() {
                        if (request.readyState === 4 && request.status === 200) {
                            var thankYou = this.querySelector('div.succesMessage');
                            var formContainer = this.querySelector('div.formContainer');
                            if (thankYou != null && formContainer != null) {
                                formContainer.style.display = 'none';
                                thankYou.style.display = 'block';
                                thankYou.style.opacity = 1;
                            }
                        } else if (request.readyState === 4 && request.status > 200) {
                            var submitButton = this.querySelector('button[type=submit]');
                            submitButton.classList.remove('loading');
                        }
                    }.bind(form);

                    request.open(form.method, form.getAttribute('action'));
                    request.send(data);
                }
            })
        }
    }
}

function loadAjaxContent(linkUrl) {

    linkUrl = linkUrl+'?ajax=true';

    canvasContent.innerHTML = '';

    //RESET hamburgerMenu
    var menuContainer = menuContainers[0];
    menuContainer.classList.remove('is-active');
    for (var i = 0, len = menuButtons.length; i < len; i++) {
        menuButtons[i].classList.remove('is-active');
    }

    axios.get(linkUrl, {
        headers: {'X-Requested-With': 'XMLHttpRequest'}
    })
        .then(function (response) {
            canvasContent.innerHTML = response.data;
            Array.prototype.slice.call(document.querySelectorAll('.projectNavigation')).forEach(function (element, index) {
                setTimeout(function () {
                    this.classList.add('open');
                    loadContentPage();
                }.bind(element), 500);
            });
        })
        .catch(function (error) {
            alert('Er ging iets mis met het inladen van de content. Probeer het later nogmaals.')
            canviContent.close();
        })
        .then(function () {
            // always executed
        });

    var isOpen = document.querySelector('body').classList.contains('is-canvi-open');
    if (isOpen == false) {
        canviContent.open();
    }
}


function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function clearKeepOpen() {
    var shownImages = document.querySelectorAll('.project.keepOpen');
    [].forEach.call(shownImages, function (el) {
        el.classList.remove("keepOpen");
    });
}
function clearShownImages() {
    var shownImages = document.querySelectorAll('.project.show');
    [].forEach.call(shownImages, function (el) {
        el.classList.remove("show");
    });
}
function clearBodyColor() {
    document.body.classList.remove('pink');
    document.body.classList.remove('yellow');
    document.body.classList.remove('green');
    document.body.classList.remove('blue');
}

var autoExpand = function (field) {

    // Reset field height
    field.style.height = 'inherit';

    // Get the computed styles for the element
    var computed = window.getComputedStyle(field);

    // Calculate the height
    var height = parseInt(computed.getPropertyValue('border-top-width'), 10)
        + parseInt(computed.getPropertyValue('padding-top'), 10)
        + field.scrollHeight
        + parseInt(computed.getPropertyValue('padding-bottom'), 10)
        + parseInt(computed.getPropertyValue('border-bottom-width'), 10);

    field.style.height = height + 'px';

};