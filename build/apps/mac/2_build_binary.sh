if [ -z "$1" ]
  then
    echo "You must pass the path for the build as an argument."
    exit 1
fi

source "$1/venv/bin/activate" || exit 1
cd "$1" || exit 1

pyinstaller --clean --onefile \
            --add-data "exhibitera/apps/_fonts/:exhibitera/apps/_fonts/." \
            --add-data "exhibitera/apps/_static/:exhibitera/apps/_static/." \
            --add-data "exhibitera/apps/api/:exhibitera/apps/api/." \
            --add-data "exhibitera/apps/css/:exhibitera/apps/css/." \
            --add-data "exhibitera/apps/dmx_control/:exhibitera/apps/dmx_control/." \
            --add-data "exhibitera/apps/image_compare/:exhibitera/apps/image_compare/." \
            --add-data "exhibitera/apps/infostation/:exhibitera/apps/infostation/." \
            --add-data "exhibitera/apps/js/:exhibitera/apps/js/." \
            --add-data "exhibitera/apps/media_browser/:exhibitera/apps/media_browser/." \
            --add-data "exhibitera/apps/media_player/:exhibitera/apps/media_player/." \
            --add-data "exhibitera/apps/other/:exhibitera/apps/other/." \
            --add-data "exhibitera/apps/timelapse_viewer/:exhibitera/apps/timelapse_viewer/." \
            --add-data "exhibitera/apps/timeline_explorer/:exhibitera/apps/timeline_explorer/." \
            --add-data "exhibitera/apps/voting_kiosk/:exhibitera/apps/voting_kiosk/." \
            --add-data "exhibitera/apps/word_cloud/:exhibitera/apps/word_cloud/." \
            --add-data "exhibitera/apps/*.html:exhibitera/apps/." \
            --add-data "exhibitera/apps/*.md:exhibitera/apps/." \
            --add-data "exhibitera/apps/*.py:exhibitera/apps/." \
            --add-data "exhibitera/apps/*.txt:exhibitera/apps/." \
            --add-data "exhibitera/common/:exhibitera/common/." \
            --runtime-tmpdir ./AppData/ \
            Exhibitera_Apps.py