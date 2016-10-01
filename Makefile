bundle.js: shepard.js
	browserify shepard.js >bundle.js

all: bundle.js
