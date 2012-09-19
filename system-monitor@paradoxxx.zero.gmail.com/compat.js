const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;

function color_from_string(color){
    let clutterColor, res;

    let shell_Version = Config.PACKAGE_VERSION;
    if (shell_Version < "3.5.4"){
        clutterColor = new Clutter.Color();
        clutterColor.from_string(color);
    } else {
        [res, clutterColor] = Clutter.Color.from_string(color);
    }
  
    return clutterColor;

}
