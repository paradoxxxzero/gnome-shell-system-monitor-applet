const Config = imports.misc.config;
const Clutter = imports.gi.Clutter;

function color_from_string(color){
    let clutterColor, res;

    if (!Clutter.Color.from_string){
        clutterColor = new Clutter.Color();
        clutterColor.from_string(color);
    } else {
        [res, clutterColor] = Clutter.Color.from_string(color);
    }
  
    return clutterColor;

}
