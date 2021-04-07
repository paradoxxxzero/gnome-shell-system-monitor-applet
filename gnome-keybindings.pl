#!/usr/bin/perl
# This is a script to get the keybindings for gnome keyboard shortcuts and save/restore them via vnc.

use strict;

my $action = '';
my $filename = '-';

for my $arg (@ARGV){
    if ($arg eq "-e" or $arg eq "--export"){
        $action = 'export';
    } elsif ($arg eq "-i" or $arg eq "--import"){
        $action = 'import';
    } elsif ($arg eq "-h" or $arg eq "--help"){
        print "Import and export keybindings\n";
        print " -e, --export <filename>\n";
        print " -i, --import <filename>\n";
        print " -h, --help\n";
        exit;
    } elsif ($arg =~ /^\-/){
        die "Unknown argument $arg";
    } else {
        $filename = $arg;
        if (!$action){
            if ( -e $filename){
                $action='import';
            } else {
                $action='export';
            }
        }
    }
}

$action='export' if (!$action);
if ($action eq 'export'){
    &export();
} else {
    &import();
}

sub export(){
    my $gsettingsFolders = [
        ['org.gnome.desktop.wm.keybindings','.'],
        ['org.gnome.settings-daemon.plugins.power','button'],
        ['org.gnome.settings-daemon.plugins.media-keys','.'],
    ];

    my $customBindings = [
    ];

    $filename = ">$filename";
    open (my $fh, $filename) || die "Can't open file $filename: $!";

    for my $folder (@$gsettingsFolders){
        my @keylist = split(/\n/, `gsettings list-recursively $folder->[0]`);
        foreach my $line (@keylist){
            if ($line =~ /^([^ ]+) ([^ ]+)(?: \@[a-z]+)? (.*)/){
                my ($path, $name, $value) = ($1,$2,$3);
                if ($name eq "custom-keybindings"){
                    $value =~ s/[\[\]\' ]//g;
                    my @c = split(/,/, $value);
                    $customBindings = \@c;
                } elsif ($name =~ /$folder->[1]/){
                    if ($value =~ /^\[|\'/){
                        if ($value =~ /^\[\'(?:disabled)?\'\]$/){
                            $value = '[]';
                        } 
                        print $fh "$path\t$name\t$value\n";
                    }
                }        
            } else {
                die "Could note parse $line";
            }
        }
    }   

    for my $folder (@$customBindings){
        my $gs = `gsettings list-recursively org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$folder`;
        my ($binding) = $gs =~ /org.gnome.settings-daemon.plugins.media-keys.custom-keybinding binding (\'[^\n]+\')/g;
        my ($command) = $gs =~ /org.gnome.settings-daemon.plugins.media-keys.custom-keybinding command (\'[^\n]+\')/g;
        my ($name) = $gs =~ /org.gnome.settings-daemon.plugins.media-keys.custom-keybinding name (\'[^\n]+\')/g;
        print $fh "custom\t$name\t$command\t$binding\n"    
    }

    close($fh);
}

sub import(){

    $filename = "<$filename";
    open (my $fh, $filename) || die "Can't open file $filename: $!";

    my $customcount=0;

    while (my $line = <$fh>){
        chomp $line;
        if ($line){
            my @v = split(/\t/, $line);
            if (@v[0] eq 'custom'){
                my ($custom, $name, $command, $binding) = @v;
                print "Installing custom keybinding: $name\n";
                print `gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom$customcount/ name \"$name\"`;
                print `gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom$customcount/ command \"$command\"`;
                print `gsettings set org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom$customcount/ binding \"$binding\"`;
                $customcount++;
            } else {
                my ($path, $name, $value) = @v;
                print "Importing $path $name\n";
                print `gsettings set \"$path\" \"$name\" \"$value\"`;
            }
        }       
    }
    if ($customcount > 0){
        my $customlist = "";
        for (my $i=0; $i<$customcount; $i++){
            $customlist .= "," if ($customlist);
            $customlist .= "'/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/custom$i/'";            
        }
        $customlist = "[$customlist]";
        print "Importing list of custom keybindings.\n";
        print `gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings \"$customlist\"`;
    }

    close($fh);
}