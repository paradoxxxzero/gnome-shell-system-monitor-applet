This is a dockerized script for uploading new versions of this extension to
extensions.gnome.org under GitHub Actions. Selenium is used to login and
upload the extension since there's no upload API on the extensions web
site.

The docker image is automatically built on-demand by GitHub Actions.
