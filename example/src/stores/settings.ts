import { makeAutoObservable } from 'mobx';
class Settings {
  dark = false;
  haptics = false;
  constructor() {
    makeAutoObservable(this);
  }
  setDark = (value: boolean) => {
    this.dark = value;
  };
  setHaptics = (value: boolean) => {
    this.haptics = value;
  };
}
export const settings = new Settings();
