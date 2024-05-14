import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import {AppComponent} from './app.component';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatButtonModule} from '@angular/material/button';
import {MatToolbarModule} from '@angular/material/toolbar';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatSnackBarModule} from '@angular/material/snack-bar';
import {MatTabsModule} from '@angular/material/tabs';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatListModule} from '@angular/material/list';
import {MatRadioModule} from '@angular/material/radio';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {MatSelectModule} from '@angular/material/select';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatInputModule} from '@angular/material/input';
import {MatCardModule} from '@angular/material/card';
import {MatDialogModule} from '@angular/material/dialog';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatChipsModule} from '@angular/material/chips';
import {MatTableModule} from '@angular/material/table';

import { IcdMapComponent } from './icd-map/icd-map.component';
import { AutocompleteBindingComponent } from './autocomplete-binding/autocomplete-binding.component';
import { LoadingDialogComponent } from './alerts/loading-dialog.component';
import { SimpleMapComponent } from './simple-map/simple-map.component';


@NgModule({
  declarations: [
    AppComponent,
    IcdMapComponent,
    AutocompleteBindingComponent,
    LoadingDialogComponent,
    SimpleMapComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    MatSlideToggleModule,
    MatButtonModule,
    MatToolbarModule,
    MatIconModule,
    MatMenuModule,
    HttpClientModule,
    MatSnackBarModule,
    MatTabsModule,
    MatFormFieldModule,
    MatListModule,
    MatRadioModule,
    FormsModule,
    ReactiveFormsModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatAutocompleteModule,
    MatInputModule,
    MatCardModule,
    MatDialogModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTableModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
